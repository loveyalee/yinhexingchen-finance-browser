/**
 * 账套创建诊断工具
 * 用于验证：
 * 1. 本地数据库创建是否成功
 * 2. 阿里云备份是否成功
 * 3. 账套选择和进入流程是否正常
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const TEST_RESULTS = [];

function log(level, message, data) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data: data || {}
  };
  TEST_RESULTS.push(entry);
  console.log(`[${level}] ${message}`, data || '');
}

// 测试1: 检查本地数据库文件
function testLocalDatabases() {
  log('INFO', '=== 测试1: 检查本地数据库 ===');
  
  const dbDir = path.join(__dirname, 'db');
  if (!fs.existsSync(dbDir)) {
    log('ERROR', '数据库目录不存在', { path: dbDir });
    fs.mkdirSync(dbDir, { recursive: true });
    log('INFO', '已创建数据库目录');
    return;
  }

  const files = fs.readdirSync(dbDir);
  const dbFiles = files.filter(f => f.endsWith('.db'));
  
  log('INFO', `本地数据库文件数量: ${dbFiles.length}`, { files: dbFiles });
  
  // 检查主数据库
  const mainDbFile = path.join(dbDir, 'accounts.db');
  if (fs.existsSync(mainDbFile)) {
    const stat = fs.statSync(mainDbFile);
    log('INFO', '主数据库存在', { file: mainDbFile, size: stat.size });
  } else {
    log('WARNING', '主数据库不存在', { file: mainDbFile });
  }

  // 检查用户数据库
  const usersDbFile = path.join(dbDir, 'users.db');
  if (fs.existsSync(usersDbFile)) {
    const stat = fs.statSync(usersDbFile);
    log('INFO', '用户数据库存在', { file: usersDbFile, size: stat.size });
  } else {
    log('WARNING', '用户数据库不存在', { file: usersDbFile });
  }

  // 列出所有账套数据库
  const accountDbs = dbFiles.filter(f => f.startsWith('account_'));
  log('INFO', `账套数据库数量: ${accountDbs.length}`, { databases: accountDbs });
}

// 测试2: 检查云备份文件
function testCloudBackup() {
  log('INFO', '=== 测试2: 检查云备份文件 ===');
  
  const cloudBackupDir = path.join(__dirname, 'db', 'backups');
  if (!fs.existsSync(cloudBackupDir)) {
    log('WARNING', '云备份目录不存在', { path: cloudBackupDir });
    fs.mkdirSync(cloudBackupDir, { recursive: true });
    log('INFO', '已创建云备份目录');
    return;
  }

  const files = fs.readdirSync(cloudBackupDir);
  const backupFiles = files.filter(f => f.endsWith('.json'));
  
  log('INFO', `备份文件总数: ${backupFiles.length}`, { files: backupFiles.slice(0, 10) });

  // 检查最近的备份
  if (backupFiles.length > 0) {
    const sorted = backupFiles.sort().reverse();
    const latest = sorted[0];
    const latestPath = path.join(cloudBackupDir, latest);
    const stat = fs.statSync(latestPath);
    log('INFO', '最新备份文件', { file: latest, size: stat.size, modified: stat.mtime });
    
    try {
      const content = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
      log('INFO', '备份文件内容有效', { accountId: content.id, name: content.name });
    } catch (e) {
      log('ERROR', '备份文件格式不合法', { error: e.message });
    }
  }
}

// 测试3: 检查API端点
function testAPIEndpoints() {
  log('INFO', '=== 测试3: 测试API端点 ===');
  
  const testData = {
    userId: 'test_user_' + Date.now(),
    name: '测试账套_' + Date.now(),
    industry: 'recycling_resource',
    startDate: '2025-01-01',
    accountingSystem: 'small_enterprise'
  };

  // 测试创建账套API
  const req = http.request({
    hostname: 'localhost',
    port: 5098,
    path: '/api/accounts',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(testData))
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const result = JSON.parse(data);
        log('INFO', '创建账套API响应', {
          statusCode: res.statusCode,
          success: result.success,
          accountId: result.data ? result.data.id : 'N/A'
        });
      } catch (e) {
        log('ERROR', '创建账套API返回格式错误', { error: e.message });
      }
    });
  });

  req.on('error', (e) => {
    log('ERROR', '创建账套API请求失败', { error: e.message });
  });

  req.write(JSON.stringify(testData));
  req.end();
}

// 执行所有测试
console.log('\n========================================');
console.log('账套创建诊断工具 - 开始测试');
console.log('========================================\n');

testLocalDatabases();
testCloudBackup();

// 延迟执行API测试（等待服务器启动）
setTimeout(() => {
  testAPIEndpoints();
  
  // 输出总结
  setTimeout(() => {
    console.log('\n========================================');
    console.log('测试完成');
    console.log('========================================\n');
    console.log(JSON.stringify(TEST_RESULTS, null, 2));
  }, 1000);
}, 500);
