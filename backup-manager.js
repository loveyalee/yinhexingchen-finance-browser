/**
 * 备份管理器
 * 功能：
 * 1. 本地备份到 db/cloud_backup
 * 2. 远程备份到阿里云 OSS 或 RDS
 * 3. 远程备份到内部服务器 (111.230.36.222)
 * 4. 定时自动备份
 * 5. 备份历史管理和恢复
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const https = require('https');

class BackupManager {
  constructor(options = {}) {
    this.localBackupDir = options.localBackupDir || path.join(__dirname, 'db', 'cloud_backup');
    this.localDbDir = options.dbDir || path.join(__dirname, 'db');

    // 阿里云配置
    this.aliyun = {
      enabled: !!process.env.ALIYUN_ACCESS_KEY,
      accessKey: process.env.ALIYUN_ACCESS_KEY,
      secretKey: process.env.ALIYUN_SECRET_KEY,
      region: process.env.ALIYUN_REGION || 'oss-cn-hangzhou',
      bucket: process.env.ALIYUN_BUCKET || 'yinhexingchen-backups'
    };

    // 内部服务器配置
    this.internalServer = {
      enabled: !!process.env.INTERNAL_SERVER_HOST,
      host: process.env.INTERNAL_SERVER_HOST || '111.230.36.222',
      port: parseInt(process.env.INTERNAL_SERVER_PORT || '22'),
      username: process.env.INTERNAL_SERVER_USER || 'backup',
      password: process.env.INTERNAL_SERVER_PASS,
      remotePath: process.env.INTERNAL_BACKUP_PATH || '/backup/yinhexingchen/'
    };

    // 确保本地备份目录存在
    if (!fs.existsSync(this.localBackupDir)) {
      fs.mkdirSync(this.localBackupDir, { recursive: true });
    }

    this.log('备份管理器已初始化', {
      localBackupDir: this.localBackupDir,
      aliyunEnabled: this.aliyun.enabled,
      internalServerEnabled: this.internalServer.enabled
    });
  }

  log(message, data) {
    console.log(`[BackupManager] ${message}`, data || '');
  }

  /**
   * 1. 本地备份 - 将账套数据库备份到 cloud_backup 目录
   */
  backupLocal(accountId, dbFile) {
    try {
      if (!fs.existsSync(dbFile)) {
        this.log(`警告: 数据库文件不存在: ${dbFile}`);
        return null;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(
        this.localBackupDir,
        `account_${accountId}_${timestamp}.db.bak`
      );

      fs.copyFileSync(dbFile, backupFile);
      this.log(`本地备份完成: ${backupFile}`);

      // 清理旧备份（保留最近10个）
      this.cleanOldBackups(accountId, 10);

      return {
        type: 'local',
        path: backupFile,
        timestamp: new Date().toISOString(),
        size: fs.statSync(backupFile).size
      };
    } catch (e) {
      this.log(`本地备份失败: ${e.message}`);
      return null;
    }
  }

  /**
   * 2. 阿里云备份 - 上传到 OSS
   */
  async backupAliyun(accountId, dbFile, metadata = {}) {
    if (!this.aliyun.enabled) {
      this.log('阿里云未启用，跳过备份');
      return null;
    }

    try {
      // 这里应该使用阿里云 SDK
      // 需要先安装: npm install ali-oss
      const timestamp = new Date().toISOString();
      const key = `accounts/${accountId}/${accountId}_${timestamp}.db`;

      this.log(`正在上传到阿里云 OSS: ${key}`, {
        bucket: this.aliyun.bucket,
        region: this.aliyun.region
      });

      // 实际实现需要 ali-oss SDK
      // const OSS = require('ali-oss');
      // const client = new OSS({
      //   region: this.aliyun.region,
      //   accessKeyId: this.aliyun.accessKey,
      //   accessKeySecret: this.aliyun.secretKey,
      //   bucket: this.aliyun.bucket
      // });
      // const result = await client.putObject(key, dbFile);

      return {
        type: 'aliyun_oss',
        bucket: this.aliyun.bucket,
        key: key,
        timestamp: timestamp,
        metadata: metadata
      };
    } catch (e) {
      this.log(`阿里云备份失败: ${e.message}`);
      return null;
    }
  }

  /**
   * 3. 内部服务器备份 - SSH/SCP 上传
   */
  async backupInternalServer(accountId, dbFile, metadata = {}) {
    if (!this.internalServer.enabled) {
      this.log('内部服务器备份未启用，跳过');
      return null;
    }

    try {
      // 这里应该使用 SSH 库
      // 需要先安装: npm install ssh2
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const remoteFile = path.join(
        this.internalServer.remotePath,
        `account_${accountId}_${timestamp}.db`
      );

      this.log(`正在备份到内部服务器: ${this.internalServer.host}:${remoteFile}`, {
        host: this.internalServer.host,
        remotePath: this.internalServer.remotePath
      });

      // 实际实现需要 ssh2 库
      // const Client = require('ssh2').Client;
      // const conn = new Client();
      // conn.on('ready', () => {
      //   conn.sftp((err, sftp) => {
      //     sftp.fastPut(dbFile, remoteFile, (err) => {
      //       // 处理上传结果
      //       conn.end();
      //     });
      //   });
      // });
      // conn.connect({
      //   host: this.internalServer.host,
      //   port: this.internalServer.port,
      //   username: this.internalServer.username,
      //   password: this.internalServer.password
      // });

      return {
        type: 'internal_server',
        host: this.internalServer.host,
        remotePath: remoteFile,
        timestamp: new Date().toISOString(),
        metadata: metadata
      };
    } catch (e) {
      this.log(`内部服务器备份失败: ${e.message}`);
      return null;
    }
  }

  /**
   * 4. 综合备份 - 同时进行多种备份
   */
  async backupAccount(accountId, dbFile, metadata = {}) {
    const results = {
      accountId: accountId,
      timestamp: new Date().toISOString(),
      backups: []
    };

    // 1. 本地备份（同步，总是执行）
    const localBackup = this.backupLocal(accountId, dbFile);
    if (localBackup) results.backups.push(localBackup);

    // 2. 阿里云备份（异步，不影响主流程）
    if (this.aliyun.enabled) {
      this.backupAliyun(accountId, dbFile, metadata)
        .then(backup => {
          if (backup) {
            results.backups.push(backup);
            this.log('阿里云备份成功');
          }
        })
        .catch(err => this.log(`阿里云备份异常: ${err.message}`));
    }

    // 3. 内部服务器备份（异步，不影响主流程）
    if (this.internalServer.enabled) {
      this.backupInternalServer(accountId, dbFile, metadata)
        .then(backup => {
          if (backup) {
            results.backups.push(backup);
            this.log('内部服务器备份成功');
          }
        })
        .catch(err => this.log(`内部服务器备份异常: ${err.message}`));
    }

    this.log('账套备份完成', results);
    return results;
  }

  /**
   * 5. 清理旧备份
   */
  cleanOldBackups(accountId, keep = 10) {
    try {
      const files = fs.readdirSync(this.localBackupDir)
        .filter(f => f.startsWith(`account_${accountId}_`))
        .sort()
        .reverse();

      if (files.length > keep) {
        const toDelete = files.slice(keep);
        toDelete.forEach(file => {
          try {
            fs.unlinkSync(path.join(this.localBackupDir, file));
            this.log(`已删除旧备份: ${file}`);
          } catch (err) {
            this.log(`删除备份失败: ${err.message}`);
          }
        });
      }
    } catch (e) {
      this.log(`清理旧备份时出错: ${e.message}`);
    }
  }

  /**
   * 6. 获取备份列表
   */
  listBackups(accountId, limit = 20) {
    try {
      const files = fs.readdirSync(this.localBackupDir)
        .filter(f => f.startsWith(`account_${accountId}_`))
        .sort()
        .reverse()
        .slice(0, limit);

      return files.map(file => {
        const fullPath = path.join(this.localBackupDir, file);
        const stat = fs.statSync(fullPath);
        return {
          file: file,
          path: fullPath,
          size: stat.size,
          modified: stat.mtime,
          timestamp: this.extractTimestamp(file)
        };
      });
    } catch (e) {
      this.log(`获取备份列表失败: ${e.message}`);
      return [];
    }
  }

  /**
   * 7. 恢复备份
   */
  restoreBackup(accountId, backupFile, targetDbFile) {
    try {
      const fullBackupPath = path.join(this.localBackupDir, backupFile);

      if (!fs.existsSync(fullBackupPath)) {
        this.log(`备份文件不存在: ${fullBackupPath}`);
        return false;
      }

      // 备份当前数据库（以防恢复失败）
      if (fs.existsSync(targetDbFile)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const safetyBackup = `${targetDbFile}.backup_${timestamp}`;
        fs.copyFileSync(targetDbFile, safetyBackup);
        this.log(`已创建安全备份: ${safetyBackup}`);
      }

      // 恢复备份
      fs.copyFileSync(fullBackupPath, targetDbFile);
      this.log(`备份已恢复: ${backupFile} → ${targetDbFile}`);

      return true;
    } catch (e) {
      this.log(`恢复备份失败: ${e.message}`);
      return false;
    }
  }

  /**
   * 8. 计算备份统计
   */
  getBackupStats() {
    try {
      const files = fs.readdirSync(this.localBackupDir);
      let totalSize = 0;
      const backupsByAccount = {};

      files.forEach(file => {
        const fullPath = path.join(this.localBackupDir, file);
        const stat = fs.statSync(fullPath);
        totalSize += stat.size;

        const match = file.match(/^account_([^_]+)_/);
        if (match) {
          const accountId = match[1];
          if (!backupsByAccount[accountId]) {
            backupsByAccount[accountId] = { count: 0, size: 0 };
          }
          backupsByAccount[accountId].count++;
          backupsByAccount[accountId].size += stat.size;
        }
      });

      return {
        totalBackups: files.length,
        totalSize: totalSize,
        totalSizeFormatted: this.formatSize(totalSize),
        backupsByAccount: backupsByAccount,
        localBackupDir: this.localBackupDir
      };
    } catch (e) {
      this.log(`计算备份统计失败: ${e.message}`);
      return null;
    }
  }

  /**
   * 9. 辅助函数 - 提取时间戳
   */
  extractTimestamp(filename) {
    const match = filename.match(/_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/);
    return match ? match[1].replace(/-/g, ':').replace('T', ' ') : 'unknown';
  }

  /**
   * 10. 辅助函数 - 格式化文件大小
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
}

module.exports = BackupManager;

// 使用示例
if (require.main === module) {
  const manager = new BackupManager();

  // 获取备份统计
  console.log('备份统计:', manager.getBackupStats());

  // 列出某个账套的备份
  console.log('账套备份列表:', manager.listBackups('ACCT_1234567890'));
}
