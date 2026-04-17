#!/usr/bin/env node

/**
 * 数据库配置验证工具
 * 用于检查数据库配置是否正确，包括：
 * 1. 阿里云 RDS MySQL 连接
 * 2. 本地 SQLite 配置
 * 3. 备份服务器 SSH 连接
 * 4. 磁盘空间和权限
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
require('dotenv').config();

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  bold: '\x1b[1m'
};

class DatabaseConfigVerifier {
  constructor() {
    this.results = [];
  }

  log(type, message, details = '') {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    let symbol = '';
    let color = colors.reset;

    switch (type) {
      case 'success':
        symbol = '✅';
        color = colors.green;
        break;
      case 'error':
        symbol = '❌';
        color = colors.red;
        break;
      case 'warning':
        symbol = '⚠️ ';
        color = colors.yellow;
        break;
      case 'info':
        symbol = 'ℹ️ ';
        color = colors.blue;
        break;
    }

    const log = `${symbol} [${timestamp}] ${message}`;
    console.log(`${color}${log}${colors.reset}${details ? ` - ${details}` : ''}`);
    this.results.push({ type, message, details });
  }

  // 1. 检查环境变量
  checkEnvironmentVariables() {
    console.log(`\n${colors.bold}1. 环境变量检查${colors.reset}`);

    const requiredVars = [
      'MYSQL_HOST',
      'MYSQL_PORT',
      'MYSQL_DATABASE',
      'MYSQL_USER',
      'MYSQL_PASSWORD'
    ];

    let allSet = true;
    requiredVars.forEach(v => {
      if (process.env[v]) {
        this.log('success', `${v} 已设置`, process.env[v].replace(/./g, '*').slice(-8));
      } else {
        this.log('error', `${v} 未设置`);
        allSet = false;
      }
    });

    return allSet;
  }

  // 2. 检查 RDS 连接
  checkRDSConnection() {
    console.log(`\n${colors.bold}2. 阿里云 RDS MySQL 连接检查${colors.reset}`);

    return new Promise((resolve) => {
      const mysql = require('mysql2/promise');

      (async () => {
        try {
          const pool = mysql.createPool({
            host: process.env.MYSQL_HOST,
            port: parseInt(process.env.MYSQL_PORT || '3306'),
            database: process.env.MYSQL_DATABASE,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            waitForConnections: true,
            connectionLimit: 1,
            queueLimit: 0
          });

          const conn = await pool.getConnection();

          // 测试连接
          const [rows] = await conn.execute('SELECT VERSION() as version');
          this.log('success', 'RDS 连接成功', `MySQL ${rows[0].version}`);

          // 检查数据库和表
          const [tables] = await conn.execute(
            `SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.TABLES
             WHERE TABLE_SCHEMA = ?`,
            [process.env.MYSQL_DATABASE]
          );

          this.log('success', '数据库表检查', `${tables[0].count} 个表存在`);

          // 检查用户表
          const [users] = await conn.execute(
            'SELECT COUNT(*) as count FROM users'
          ).catch(() => ({ 0: { count: 0 } }));

          this.log('info', '用户表统计', `${users[0].count} 条用户记录`);

          // 检查账套表
          const [accounts] = await conn.execute(
            'SELECT COUNT(*) as count FROM accounts'
          ).catch(() => ({ 0: { count: 0 } }));

          this.log('info', '账套表统计', `${accounts[0].count} 条账套记录`);

          conn.release();
          await pool.end();
          resolve(true);
        } catch (err) {
          this.log('error', 'RDS 连接失败', err.message);
          resolve(false);
        }
      })();
    });
  }

  // 3. 检查本地 SQLite
  checkLocalSQLite() {
    console.log(`\n${colors.bold}3. 本地 SQLite 检查${colors.reset}`);

    const dbDir = path.join(__dirname, 'db');
    const files = fs.readdirSync(dbDir).filter(f => f.endsWith('.db'));

    if (files.length === 0) {
      this.log('warning', '本地数据库目录为空', dbDir);
      return;
    }

    this.log('success', '本地数据库目录存在', `找到 ${files.length} 个 .db 文件`);

    files.forEach(file => {
      const fullPath = path.join(dbDir, file);
      const stat = fs.statSync(fullPath);
      this.log('info', `${file}`, `${(stat.size / 1024 / 1024).toFixed(2)} MB`);
    });
  }

  // 4. 检查备份服务器连接
  checkBackupServerConnection() {
    console.log(`\n${colors.bold}4. 备份服务器连接检查${colors.reset}`);

    return new Promise((resolve) => {
      const host = process.env.BACKUP_SERVER_HOST || '111.230.36.222';
      const port = process.env.BACKUP_SERVER_PORT || '22';
      const user = process.env.BACKUP_SERVER_USER || 'backup_user';

      // 测试 SSH 连接
      const cmd = `ssh -p ${port} ${user}@${host} "echo 'SSH connection OK' && pwd" 2>&1`;

      exec(cmd, { timeout: 5000 }, (error, stdout, stderr) => {
        if (error) {
          this.log('warning', '备份服务器连接失败',
            '可能需要配置 SSH 密钥或检查网络连接');
          this.log('info', '需要的命令',
            `ssh -p ${port} ${user}@${host}`);
          resolve(false);
          return;
        }

        this.log('success', '备份服务器连接成功', `${host}:${port}`);

        // 检查备份目录
        const checkCmd = `ssh -p ${port} ${user}@${host} "ls -lh /backup/yinhexingchen/ 2>&1 | head -5" 2>&1`;
        exec(checkCmd, { timeout: 5000 }, (err, stdout) => {
          if (err) {
            this.log('warning', '无法列出备份目录', '请检查备份目录权限');
          } else {
            this.log('success', '备份目录可访问');
            if (stdout.trim()) {
              const lines = stdout.trim().split('\n');
              this.log('info', '最近的备份文件：', lines.slice(1, 3).join(', '));
            }
          }
          resolve(true);
        });
      });
    });
  }

  // 5. 检查磁盘空间
  checkDiskSpace() {
    console.log(`\n${colors.bold}5. 磁盘空间检查${colors.reset}`);

    return new Promise((resolve) => {
      exec('df -h . | tail -1', (error, stdout) => {
        if (error) {
          this.log('warning', '无法获取磁盘信息');
          resolve();
          return;
        }

        const parts = stdout.trim().split(/\s+/);
        const usage = parts[4];
        const available = parts[3];

        this.log('info', '磁盘使用情况', `${usage} 已用, ${available} 可用`);

        const usagePercent = parseInt(usage);
        if (usagePercent > 90) {
          this.log('error', '磁盘空间严重不足', '> 90% 已用');
        } else if (usagePercent > 80) {
          this.log('warning', '磁盘空间不足', '> 80% 已用');
        } else {
          this.log('success', '磁盘空间充足');
        }

        resolve();
      });
    });
  }

  // 6. 检查备份脚本
  checkBackupScript() {
    console.log(`\n${colors.bold}6. 备份脚本检查${colors.reset}`);

    const scriptPath = path.join(__dirname, 'backup-rds-to-local.js');
    if (fs.existsSync(scriptPath)) {
      this.log('success', '备份脚本存在');
    } else {
      this.log('error', '备份脚本不存在', scriptPath);
    }

    // 检查依赖
    const requiredModules = ['mysql2', 'dotenv'];
    requiredModules.forEach(mod => {
      try {
        require(mod);
        this.log('success', `模块 ${mod} 已安装`);
      } catch (e) {
        this.log('warning', `模块 ${mod} 未安装`, '运行: npm install');
      }
    });
  }

  // 7. 检查权限
  checkPermissions() {
    console.log(`\n${colors.bold}7. 权限检查${colors.reset}`);

    const dirs = [
      { path: 'db', desc: '数据库目录' },
      { path: 'db/backups', desc: '备份目录' },
      { path: 'db/temp_backups', desc: '临时备份目录' }
    ];

    dirs.forEach(dir => {
      const fullPath = path.join(__dirname, dir.path);
      try {
        if (!fs.existsSync(fullPath)) {
          fs.mkdirSync(fullPath, { recursive: true });
          this.log('success', `${dir.desc}已创建`, fullPath);
        } else {
          // 测试写入权限
          const testFile = path.join(fullPath, '.write-test');
          fs.writeFileSync(testFile, 'test');
          fs.unlinkSync(testFile);
          this.log('success', `${dir.desc}可写入`, fullPath);
        }
      } catch (err) {
        this.log('error', `${dir.desc}权限问题`, err.message);
      }
    });
  }

  // 运行所有检查
  async runAll() {
    console.log(`\n${colors.bold}${colors.blue}
╔═══════════════════════════════════════╗
║   数据库配置验证工具 v1.0             ║
║   Powered by YinHeXingChen            ║
╚═══════════════════════════════════════╝
${colors.reset}\n`);

    const envOk = this.checkEnvironmentVariables();

    if (!envOk) {
      this.log('error', '环境变量配置不完整，无法继续');
      process.exit(1);
    }

    const rdsOk = await this.checkRDSConnection();
    this.checkLocalSQLite();
    const backupOk = await this.checkBackupServerConnection();
    await this.checkDiskSpace();
    this.checkBackupScript();
    this.checkPermissions();

    // 总结
    this.printSummary(rdsOk, backupOk);
  }

  printSummary(rdsOk, backupOk) {
    console.log(`\n${colors.bold}═══ 检查总结 ═══${colors.reset}`);

    const summary = {
      '✅ 环境变量': this.results.filter(r => r.message.includes('已设置')).length >= 5,
      '✅ RDS 连接': rdsOk,
      '✅ 本地数据库': fs.readdirSync(path.join(__dirname, 'db')).some(f => f.endsWith('.db')),
      '✅ 备份服务器': backupOk,
      '✅ 磁盘空间': !this.results.some(r => r.type === 'error' && r.message.includes('磁盘')),
      '✅ 脚本和权限': fs.existsSync(path.join(__dirname, 'backup-rds-to-local.js'))
    };

    Object.entries(summary).forEach(([key, value]) => {
      console.log(`${value ? colors.green : colors.yellow}${key}: ${value ? '通过' : '需要注意'}${colors.reset}`);
    });

    console.log(`\n${colors.bold}后续步骤：${colors.reset}`);
    if (!rdsOk) {
      console.log(`1. 检查 RDS 连接配置（.env 文件）`);
      console.log(`   - MYSQL_HOST: ${process.env.MYSQL_HOST}`);
      console.log(`   - MYSQL_DATABASE: ${process.env.MYSQL_DATABASE}`);
      console.log(`   - 确保应用服务器 IP 在 RDS 白名单中`);
    }
    if (!backupOk) {
      console.log(`2. 配置备份服务器连接`);
      console.log(`   - 安装 ssh2 模块: npm install ssh2`);
      console.log(`   - 或使用 SSH 密钥认证（更安全）`);
    }

    console.log(`\n3. 启动备份定时任务:`);
    console.log(`   node backup-rds-to-local.js schedule`);

    console.log(`\n4. 监控应用日志:`);
    console.log(`   pm2 logs\n`);
  }
}

// 运行验证
const verifier = new DatabaseConfigVerifier();
verifier.runAll().catch(console.error);
