/**
 * RDS 备份脚本
 * 功能：
 * 1. 使用 mysqldump 导出阿里云 RDS 数据库
 * 2. 通过 SCP 或 SFTP 上传到本地服务器 (111.230.36.222)
 * 3. 支持定时自动备份
 * 4. 支持备份历史管理
 *
 * 安装依赖：
 *   npm install node-cron ssh2
 *
 * 运行方式：
 *   node backup-rds-to-local.js          # 立即备份
 *   node backup-rds-to-local.js schedule # 定时备份（每天凌晨3点）
 */

const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const http = require('http');
const https = require('https');

// 尝试加载 cron 库
let cron = null;
try {
  cron = require('node-cron');
} catch (e) {
  console.warn('node-cron 未安装，定时备份不可用。安装：npm install node-cron');
}

// 配置
const config = {
  // RDS 配置
  rds: {
    host: process.env.MYSQL_HOST || 'yinhexingchen.cxhxc.rds.aliyuncs.com',
    port: process.env.MYSQL_PORT || '3306',
    database: process.env.MYSQL_DATABASE || 'yinhexingchen_prod',
    user: process.env.MYSQL_USER || 'admin',
    password: process.env.MYSQL_PASSWORD || '',
  },

  // 备份服务器配置
  backupServer: {
    host: process.env.BACKUP_SERVER_HOST || '111.230.36.222',
    port: process.env.BACKUP_SERVER_PORT || '22',
    user: process.env.BACKUP_SERVER_USER || 'backup_user',
    password: process.env.BACKUP_SERVER_PASSWORD || '',
    path: process.env.BACKUP_SERVER_PATH || '/backup/yinhexingchen/',
    keepDays: parseInt(process.env.BACKUP_SERVER_KEEPDAYS || '30'),
  },

  // 本地备份配置
  local: {
    tempDir: path.join(__dirname, 'db', 'temp_backups'),
    archiveDir: path.join(__dirname, 'db', 'backups'),
  }
};

class RDSBackup {
  constructor(cfg) {
    this.config = cfg;
    this.ensureDirectories();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.config.local.tempDir)) {
      fs.mkdirSync(this.config.local.tempDir, { recursive: true });
    }
    if (!fs.existsSync(this.config.local.archiveDir)) {
      fs.mkdirSync(this.config.local.archiveDir, { recursive: true });
    }
  }

  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level}] ${message}`, data);
  }

  /**
   * 1. 使用 mysqldump 导出数据库
   */
  async dumpDatabase() {
    return new Promise((resolve, reject) => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const dumpFile = path.join(
        this.config.local.tempDir,
        `${this.config.rds.database}_${timestamp}.sql`
      );

      const password = this.config.rds.password.replace(/'/g, "'\\''");
      const cmd = `mysqldump -h ${this.config.rds.host} \
        -P ${this.config.rds.port} \
        -u ${this.config.rds.user} \
        -p'${password}' \
        --single-transaction \
        --quick \
        --lock-tables=false \
        --charset=utf8mb4 \
        ${this.config.rds.database} > "${dumpFile}"`;

      this.log('INFO', 'Starting mysqldump...', {
        host: this.config.rds.host,
        database: this.config.rds.database,
        output: dumpFile
      });

      exec(cmd, { shell: '/bin/bash', maxBuffer: 50 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) {
          this.log('ERROR', 'mysqldump failed', { error: error.message });
          reject(error);
          return;
        }

        if (!fs.existsSync(dumpFile)) {
          const err = new Error('Dump file not created');
          this.log('ERROR', 'Dump file not created');
          reject(err);
          return;
        }

        const size = fs.statSync(dumpFile).size;
        this.log('INFO', 'mysqldump completed', {
          file: dumpFile,
          size: this.formatSize(size)
        });

        resolve(dumpFile);
      });
    });
  }

  /**
   * 2. 压缩备份文件
   */
  async compressBackup(dumpFile) {
    return new Promise((resolve, reject) => {
      const zlib = require('zlib');
      const gzFile = dumpFile + '.gz';

      this.log('INFO', 'Compressing backup...', { file: dumpFile });

      const source = fs.createReadStream(dumpFile);
      const destination = fs.createWriteStream(gzFile);
      const gzip = zlib.createGzip();

      source
        .pipe(gzip)
        .pipe(destination)
        .on('finish', () => {
          const originalSize = fs.statSync(dumpFile).size;
          const compressedSize = fs.statSync(gzFile).size;
          const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(2);

          this.log('INFO', 'Compression completed', {
            original: this.formatSize(originalSize),
            compressed: this.formatSize(compressedSize),
            ratio: `${ratio}%`
          });

          // 删除原始文件
          fs.unlinkSync(dumpFile);
          resolve(gzFile);
        })
        .on('error', (error) => {
          this.log('ERROR', 'Compression failed', { error: error.message });
          reject(error);
        });
    });
  }

  /**
   * 3. 上传到备份服务器（SSH/SCP）
   */
  async uploadToBackupServer(localFile) {
    // 如果 ssh2 不可用，跳过上传
    let Client;
    try {
      Client = require('ssh2').Client;
    } catch (e) {
      this.log('WARNING', 'ssh2 not installed, skipping remote backup. Run: npm install ssh2');
      return {
        success: false,
        message: 'ssh2 not installed',
        localFile: localFile
      };
    }

    return new Promise((resolve) => {
      const conn = new Client();
      const remoteFileName = path.basename(localFile);
      const remotePath = path.join(this.config.backupServer.path, remoteFileName);

      conn.on('ready', () => {
        this.log('INFO', 'Connected to backup server');

        conn.sftp((err, sftp) => {
          if (err) {
            this.log('ERROR', 'SFTP initialization failed', { error: err.message });
            conn.end();
            resolve({ success: false, message: err.message, localFile });
            return;
          }

          const readStream = fs.createReadStream(localFile);
          const writeStream = sftp.createWriteStream(remotePath);

          writeStream.on('finish', () => {
            this.log('INFO', 'File uploaded to backup server', {
              local: localFile,
              remote: remotePath
            });
            conn.end();
            resolve({
              success: true,
              localFile: localFile,
              remoteFile: remotePath,
              host: this.config.backupServer.host
            });
          });

          writeStream.on('error', (err) => {
            this.log('ERROR', 'Upload failed', { error: err.message });
            conn.end();
            resolve({ success: false, message: err.message, localFile });
          });

          readStream.pipe(writeStream);
        });
      }).on('error', (err) => {
        this.log('ERROR', 'Connection to backup server failed', { error: err.message });
        resolve({ success: false, message: err.message, localFile });
      }).connect({
        host: this.config.backupServer.host,
        port: this.config.backupServer.port,
        username: this.config.backupServer.user,
        password: this.config.backupServer.password
      });
    });
  }

  /**
   * 4. 清理本地旧备份
   */
  cleanOldBackups() {
    try {
      const files = fs.readdirSync(this.config.local.archiveDir)
        .filter(f => f.endsWith('.sql.gz'))
        .sort()
        .reverse();

      // 保留最近10个备份
      const toDelete = files.slice(10);
      toDelete.forEach(file => {
        const fullPath = path.join(this.config.local.archiveDir, file);
        fs.unlinkSync(fullPath);
        this.log('INFO', 'Deleted old backup', { file: file });
      });
    } catch (e) {
      this.log('WARNING', 'Failed to clean old backups', { error: e.message });
    }
  }

  /**
   * 5. 执行完整备份流程
   */
  async backup() {
    try {
      this.log('INFO', '========== RDS Backup Started ==========');

      // 1. 导出数据库
      const dumpFile = await this.dumpDatabase();

      // 2. 压缩备份
      const compressedFile = await this.compressBackup(dumpFile);

      // 3. 移动到备份目录
      const archiveFile = path.join(this.config.local.archiveDir, path.basename(compressedFile));
      fs.renameSync(compressedFile, archiveFile);

      // 4. 上传到备份服务器
      const uploadResult = await this.uploadToBackupServer(archiveFile);

      // 5. 清理旧备份
      this.cleanOldBackups();

      this.log('INFO', '========== RDS Backup Completed ==========', {
        localArchive: archiveFile,
        remoteResult: uploadResult
      });

      return {
        success: true,
        localFile: archiveFile,
        remoteUpload: uploadResult,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.log('ERROR', 'Backup failed', { error: error.message });
      throw error;
    }
  }

  /**
   * 6. 定时备份任务
   */
  scheduleBackup(cronExpression = '0 3 * * *') {
    if (!cron) {
      console.error('node-cron is required for scheduling. Install: npm install node-cron');
      return;
    }

    this.log('INFO', 'Scheduling backup', { schedule: cronExpression });

    cron.schedule(cronExpression, async () => {
      try {
        await this.backup();
      } catch (error) {
        this.log('ERROR', 'Scheduled backup failed', { error: error.message });
      }
    });

    this.log('INFO', 'Backup scheduler started', {
      schedule: cronExpression,
      description: 'Daily backup at 3:00 AM'
    });
  }

  /**
   * 7. 辅助函数 - 格式化文件大小
   */
  formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  /**
   * 8. 获取备份统计
   */
  getBackupStats() {
    try {
      const files = fs.readdirSync(this.config.local.archiveDir)
        .filter(f => f.endsWith('.sql.gz'))
        .sort()
        .reverse();

      let totalSize = 0;
      files.forEach(file => {
        const fullPath = path.join(this.config.local.archiveDir, file);
        totalSize += fs.statSync(fullPath).size;
      });

      return {
        totalBackups: files.length,
        totalSize: this.formatSize(totalSize),
        latestBackup: files[0] || 'N/A',
        backupDir: this.config.local.archiveDir
      };
    } catch (e) {
      return { error: e.message };
    }
  }
}

// 主程序
async function main() {
  const args = process.argv.slice(2);
  const backup = new RDSBackup(config);

  if (args[0] === 'schedule') {
    // 启动定时备份（每天凌晨3点）
    backup.scheduleBackup('0 3 * * *');
    console.log('Backup scheduler is running. Press Ctrl+C to stop.');
    // 保持进程运行
    setInterval(() => {}, 1000);
  } else if (args[0] === 'stats') {
    // 显示备份统计
    console.log('Backup Statistics:', backup.getBackupStats());
  } else {
    // 立即执行备份
    try {
      const result = await backup.backup();
      process.exit(result.success ? 0 : 1);
    } catch (error) {
      process.exit(1);
    }
  }
}

// 导出以供其他模块使用
module.exports = RDSBackup;

// 如果直接运行此脚本
if (require.main === module) {
  main();
}
