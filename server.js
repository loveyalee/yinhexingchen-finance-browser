// 服务器端支付处理
// 实现微信支付和支付宝支付的完整回调处理

const http = require('http');
const url = require('url');
const querystring = require('querystring');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

function loadEnvFile(envFilePath) {
  if (!fs.existsSync(envFilePath)) return;
  const lines = fs.readFileSync(envFilePath, 'utf8').split(/\r?\n/);
  lines.forEach(function(rawLine) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx <= 0) return;
    const key = line.slice(0, idx).trim();
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) return;
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
}

loadEnvFile(path.join(__dirname, '.env'));

let Dysmsapi;
let OpenApi;
let Util;
try {
  Dysmsapi = require('@alicloud/dysmsapi20170525');
  OpenApi = require('@alicloud/openapi-client');
  Util = require('@alicloud/tea-util');
} catch (e) {
  console.warn('阿里云短信 SDK 未安装，短信将保持测试模式:', e.message);
}

// ============================================================
// 数据库初始化（SQLite本地数据库 + 云端备份）
// ============================================================
let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error('better-sqlite3 未安装，账套数据库功能不可用:', e.message);
}

// 数据库目录
const dbDir = path.join(__dirname, 'db');
const cloudBackupDir = path.join(dbDir, 'cloud_backup');
const userDbDir = path.join(dbDir, 'users');
const userCloudBackupDir = path.join(cloudBackupDir, 'users');

// 确保目录存在
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
if (!fs.existsSync(cloudBackupDir)) fs.mkdirSync(cloudBackupDir, { recursive: true });
if (!fs.existsSync(userDbDir)) fs.mkdirSync(userDbDir, { recursive: true });
if (!fs.existsSync(userCloudBackupDir)) fs.mkdirSync(userCloudBackupDir, { recursive: true });

// 主账套数据库（存储所有账套元信息）
let mainDb = null;
let usersDb = null;

function initMainDb() {
  if (!Database) return;
  try {
    mainDb = new Database(path.join(dbDir, 'accounts.db'));
    usersDb = new Database(path.join(dbDir, 'users.db'));
    // 创建账套主表
    mainDb.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
        industry TEXT NOT NULL,
        start_date TEXT NOT NULL,
        accounting_system TEXT NOT NULL,
        create_time TEXT NOT NULL,
        update_time TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        last_backup_time TEXT,
        db_file TEXT
      );
    `);
    try { mainDb.exec(`ALTER TABLE accounts ADD COLUMN user_id TEXT`); } catch (e) {}
    usersDb.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        phone TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        user_type TEXT NOT NULL,
        institution_type TEXT,
        institution_name TEXT,
        credit_code TEXT,
        contact_person TEXT,
        industry TEXT,
        create_time TEXT NOT NULL,
        update_time TEXT NOT NULL,
        local_db_file TEXT,
        cloud_backup_file TEXT,
        sync_status TEXT DEFAULT 'synced',
        last_sync_time TEXT
      );
    `);
    try { usersDb.exec(`ALTER TABLE users ADD COLUMN industry TEXT`); } catch (e) {}
    // 设置控制台编码为UTF-8（Windows）
    if (process.stdout && process.stdout.isTTY) {
      process.stdout.setDefaultEncoding('utf8');
    }
    console.log('主账套数据库初始化完成: db/accounts.db');
    console.log('用户主数据库初始化完成: db/users.db');
  } catch (e) {
    console.error('主账套数据库初始化失败:', e.message);
  }
}

// 为每个账套创建独立的SQLite数据库（存储凭证、账簿等业务数据）
function initAccountDb(accountId) {
  if (!Database) return null;
  try {
    const dbFile = path.join(dbDir, `account_${accountId}.db`);
    const db = new Database(dbFile);

    // 创建凭证表
    db.exec(`
      CREATE TABLE IF NOT EXISTS vouchers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voucher_no TEXT NOT NULL,
        voucher_type TEXT DEFAULT '记账凭证',
        date TEXT NOT NULL,
        summary TEXT,
        debit_account TEXT,
        credit_account TEXT,
        amount REAL DEFAULT 0,
        attachments INTEGER DEFAULT 0,
        creator TEXT,
        auditor TEXT,
        status TEXT DEFAULT 'draft',
        create_time TEXT NOT NULL,
        update_time TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS voucher_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voucher_id INTEGER NOT NULL,
        entry_type TEXT NOT NULL,
        account_code TEXT NOT NULL,
        account_name TEXT NOT NULL,
        summary TEXT,
        debit_amount REAL DEFAULT 0,
        credit_amount REAL DEFAULT 0,
        FOREIGN KEY (voucher_id) REFERENCES vouchers(id)
      );

      CREATE TABLE IF NOT EXISTS opening_balances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_code TEXT UNIQUE NOT NULL,
        account_name TEXT NOT NULL,
        direction TEXT NOT NULL,
        amount REAL DEFAULT 0,
        auxiliary TEXT,
        create_time TEXT NOT NULL,
        update_time TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS accounts_chart (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT,
        account_type TEXT,
        balance_direction TEXT DEFAULT '借',
        is_leaf INTEGER DEFAULT 1,
        parent_code TEXT,
        level INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS periods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        status TEXT DEFAULT 'open',
        close_time TEXT,
        UNIQUE(year, month)
      );

      CREATE TABLE IF NOT EXISTS assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_no TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT,
        department TEXT,
        acquire_date TEXT,
        original_value REAL DEFAULT 0,
        accumulated_depreciation REAL DEFAULT 0,
        net_value REAL DEFAULT 0,
        useful_life INTEGER,
        depreciation_rate REAL,
        status TEXT DEFAULT 'active',
        create_time TEXT NOT NULL
      );
    `);

    console.log('账套数据库创建成功: db/account_' + accountId + '.db');
    return dbFile;
  } catch (e) {
    console.error('账套数据库创建失败 [' + accountId + ']:', e.message);
    return null;
  }
}

function getNormalizedAccountDbFile(accountId, dbFile) {
  if (!accountId) return '';
  const expectedDbFile = path.join(dbDir, `account_${accountId}.db`);
  if (!dbFile) return expectedDbFile;
  const normalized = String(dbFile).replace(/\\/g, '/');
  const expectedNormalized = expectedDbFile.replace(/\\/g, '/');
  if (normalized === expectedNormalized) return expectedDbFile;
  if (normalized.endsWith(`/account_${accountId}.db`)) return expectedDbFile;
  if (!fs.existsSync(dbFile) && fs.existsSync(expectedDbFile)) return expectedDbFile;
  return dbFile;
}

function repairAccountDbFile(accountId) {
  if (!mainDb || !accountId) return null;
  try {
    const account = mainDb.prepare('SELECT id, db_file FROM accounts WHERE id = ?').get(accountId);
    if (!account) return null;
    const normalizedDbFile = getNormalizedAccountDbFile(account.id, account.db_file);
    if (normalizedDbFile && normalizedDbFile !== account.db_file) {
      mainDb.prepare('UPDATE accounts SET db_file = ?, update_time = ? WHERE id = ?')
        .run(normalizedDbFile, new Date().toISOString(), account.id);
      return normalizedDbFile;
    }
    return account.db_file || normalizedDbFile;
  } catch (e) {
    console.error('修复账套数据库路径失败 [' + accountId + ']:', e.message);
    return null;
  }
}

function getAccountDb(accountId) {
  if (!Database || !mainDb || !accountId) return null;
  try {
    const account = mainDb.prepare('SELECT * FROM accounts WHERE id = ? AND status = ?').get(accountId, 'active');
    if (!account) return null;
    const dbFile = getNormalizedAccountDbFile(account.id, account.db_file);
    if (!dbFile) return null;
    if (dbFile !== account.db_file) {
      mainDb.prepare('UPDATE accounts SET db_file = ?, update_time = ? WHERE id = ?')
        .run(dbFile, new Date().toISOString(), account.id);
    }
    return new Database(dbFile);
  } catch (e) {
    console.error('打开账套数据库失败 [' + accountId + ']:', e.message);
    return null;
  }
}

function initUserLocalDb(userId, profile) {
  if (!Database) return null;
  try {
    const dbFile = path.join(userDbDir, `user_${userId}.db`);
    const db = new Database(dbFile);
    db.exec(`
      CREATE TABLE IF NOT EXISTS profile (
        id TEXT PRIMARY KEY,
        phone TEXT NOT NULL,
        user_type TEXT NOT NULL,
        institution_type TEXT,
        institution_name TEXT,
        credit_code TEXT,
        contact_person TEXT,
        industry TEXT,
        create_time TEXT NOT NULL,
        update_time TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        payload TEXT,
        create_time TEXT NOT NULL
      );
    `);
    db.prepare('INSERT OR REPLACE INTO profile (id, phone, user_type, institution_type, institution_name, credit_code, contact_person, industry, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(
        userId,
        profile.phone,
        profile.user_type,
        profile.institution_type || '',
        profile.institution_name || '',
        profile.credit_code || '',
        profile.contact_person || '',
        profile.industry || '',
        profile.create_time,
        profile.update_time
      );
    db.prepare('INSERT INTO sync_log (action, payload, create_time) VALUES (?, ?, ?)')
      .run('register_init', JSON.stringify(profile), new Date().toISOString());
    console.log('用户本地数据库创建成功: ' + dbFile);
    return dbFile;
  } catch (e) {
    console.error('用户本地数据库创建失败 [' + userId + ']:', e.message);
    return null;
  }
}

function cloudBackupUser(user) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(userCloudBackupDir, `${user.id}_${timestamp}.json`);
    const backupData = {
      ...user,
      backup_time: new Date().toISOString(),
      backup_type: 'auto_user_sync',
      source: 'yinhexingchen_user_profile'
    };
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
    const backupFiles = fs.readdirSync(userCloudBackupDir)
      .filter(function(f) { return f.startsWith(user.id + '_'); })
      .sort();
    if (backupFiles.length > 10) {
      backupFiles.slice(0, backupFiles.length - 10).forEach(function(f) {
        try { fs.unlinkSync(path.join(userCloudBackupDir, f)); } catch (err) {}
      });
    }
    console.log('用户云端备份完成: ' + path.basename(backupFile));
    return backupFile;
  } catch (e) {
    console.error('用户云端备份失败:', e.message);
    return null;
  }
}

function syncUserProfile(user) {
  const localDbFile = initUserLocalDb(user.id, user);
  const cloudBackupFile = cloudBackupUser(user);
  return {
    localDbFile: localDbFile || '',
    cloudBackupFile: cloudBackupFile || '',
    syncStatus: localDbFile && cloudBackupFile ? 'synced' : 'partial',
    lastSyncTime: new Date().toISOString()
  };
}

function isPhoneAccount(account) {
  return /^1[3-9]\d{9}$/.test(String(account || '').trim());
}

// 云端备份：将账套元信息写入备份文件（模拟云备份，实际可替换为上传到云存储）
function cloudBackupAccount(account) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = account.id + '_' + timestamp + '.json';
    const backupFile = path.join(cloudBackupDir, backupFileName);
    const backupData = {
      id: account.id,
      name: account.name,
      industry: account.industry,
      start_date: account.start_date,
      accounting_system: account.accounting_system,
      create_time: account.create_time,
      backup_time: new Date().toISOString(),
      backup_type: 'auto',
      source: 'yinhexingchen_accounting'
    };
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');

    // 只保留最近10个备份
    const backupFiles = fs.readdirSync(cloudBackupDir)
      .filter(function(f) { return f.startsWith(account.id + '_'); })
      .sort();
    if (backupFiles.length > 10) {
      backupFiles.slice(0, backupFiles.length - 10).forEach(function(f) {
        try { fs.unlinkSync(path.join(cloudBackupDir, f)); } catch (err) {}
      });
    }

    console.log('云端备份完成: ' + backupFileName);
    return backupFile;
  } catch (e) {
    console.error('云端备份失败:', e.message);
    return null;
  }
}

// 初始化主数据库
initMainDb();

// 征信打印点数据文件
const creditPrintPointsFile = path.join(__dirname, 'credit_print_points.json');

// 支付配置
const paymentConfig = {
  wechat: {
    appId: 'wx92fd4eb7a9df0364',
    mchId: '1105671520',
    apiKey: 'a1b2c3D4e5f6g7h8i9j0k1l2m3n4o5p6',
    notifyUrl: 'https://zonya.work/api/wechat/notify'
  },
  alipay: {
    appId: '2021006144613372',
    privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCULKugNhHMXcF6gUoABoB6AxsCeC2hAJYdmk1dzc6vbFZULCTWwiz6kLE7CLbzoaVvMiy5IdyepCUNHn73CHgmBPhyQodRwpoISjCynxh3GUD79AmDvO/V59FZKbCCbRFzTY8HUc3kLIoBkt2cT2tnQ9g6jQZ9MeNXX6uBh3BLa1zTOxwukGOPffp0rKh+rP9GEFmeg6AoQOjtATttt94qvVCwWsFzVn+h0oi2W/2GlLAtjPUb0zqcDYns19ifXhmAkOalD4lXmsG06EDazfogq7gtI/xFdOaNghG+2ry1DmQHV4imgHRRZNBnWgvHbYKI5kgDi8ippDPGT+DJ9047AgMBAAECggEAT6+6WP3bEoo1XBmd32efvn5fDzPsbhKvqJnsE490IRllT/0xjqF8qQAZoELuiRWcr7FPJf0U9egW2PhWlanjW6b+qgwnVAwQ5HZpvBYdhSd6sEUsvMFmRiZWitoFyA65/MVwLyKKVLSzP2dpcP+xJibxaYOgQsIKnlmgFZfuB1CSdF3gs4Nvir04QP3NQcR1Wp5RyAu+1fxvg2jwqbgU+GlQXGrGdOmLgxhPl4BhAmd89PLJKYWNuDJVMMtRTEWnmyrNqyFbRezMTPrnX7gTuL6bU/xs1o+zAwkSpE8pDZ74jbmCxrnBjEnHFlJzqSFgI9iNSyq0tEE8VEoYfdIWEQKBgQDWenXT+/40Q6iHrgk9iDRGw/wXahWCkPT+rC2rIO/cFStJJMsiKjXQM6aMBMV562P9ullHistw9ymd1rItqKY8hSFrfeSirDfOnFu7jfdAg/pSt1ZyAPqumhsFUBYQQp8OWoJfV0nzXbxOK9BVxha2B0XmRjhlVf4Z0hCla93UwwKBgQCw3DFj/eyzjDYeFwW/nTLcLaa5FxT+eBdAYIGaO0VewUL389ddODufTuHYGhKgyPfUNu6Dw2AaI646YNN+74yu1ODOdThoessoE7l4uPz2v/CnMoBrDJ/6HnlgZw5QpV2wxKYmE1JsImr8EZ3f2H8YLrsnYT1lLeEer6BNWF8pKQKBgBeg3iJAfLzdR0/LSJFS1A+Hv9oEgeIkfhkgdteHhWVFn8MrHoXhCJSrXAnI7MiFujpVsUhEbi0/zYHqCS8miUnZkNj6wZl6R5undiOvfDHLWGSMdiWRHgzmRVvMeuHHtSYrqnk+cJMzHG+wO/93F0Fug7Dew4/GbXwCvHq8629pAoGAPtGXQXr5zjRpLHrk8dB2NjqI04ldTZ1+NMGShyOyWhuvG78iqdvFYap1EXsBTtbTIC96vJZy1hYCVn354UZY4+h9CRgdtw6Whl+rKzQZtdMrOVf4wQ007XRRjGpObVqvUpAmq7OFPR9kfLANMWsGiaJfm3cwhXWsVmfvOkm/UzECgYBtkyEWROS/5N/UL1no+jGNVeHoWct8G4usbS4yek35CXn4vzC/6FiJl88waibWbpmgV996LNvP+YdYDvrsY02PiMfXt/WGcCFnHr0q0CfjTAKW2HLCUVHUTCGjtqAOmVum2UY6y4RtT8Rlt22Zgz7bwH4+6z8Ou3QjUVQps3zkjg==
-----END PRIVATE KEY-----`,
    publicKey: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlSn3KRaaFHb2KmF/sAIojWWKeAt9tOY+mwo4tRODLjx5a6Lvfiafruf3lyxGv58YmjHh6IULQU/b0DaS6URpdbCJQuFvnv4EPqebnaKdiiQXtCaSGamINiZp9qWRKFqJs87v+aw7uT0sEMt/l6b/yEi1YziEL6CRF8JRc0UaOwDpOmlQs47Q3cGSRdPDXd2KRvLTiiPQgJ2iUVH2e3NtwSVCLj/g+m6VawY+5mZZ22vulQz/txi6iaBf9BM8RhrRSI1sE4eGl5Djh6ByVJGb0P1XW5u2/Vs6Mt1wBvfiYNVwSCPwPUG06fGtSkONLPgcinCY4fiYRTX/dTtyxwa5SwIDAQAB
-----END PUBLIC KEY-----`,
    notifyUrl: 'https://zonya.work/api/alipay/notify'
  }
};

// 订单存储（生产环境建议使用数据库）
const orders = {};
const smsCodes = {};
const smsSendLocks = {};
const smsEventLogs = [];
const orderFile = path.join(__dirname, 'orders.json');

function generateSmsCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function addSmsEventLog(event) {
  smsEventLogs.unshift({
    time: new Date().toISOString(),
    phone: event.phone || '',
    purpose: event.purpose || 'register',
    status: event.status || 'info',
    detail: event.detail || ''
  });
  if (smsEventLogs.length > 50) {
    smsEventLogs.length = 50;
  }
}

function getSmsLockKey(phone, purpose) {
  return `${purpose}:${phone}`;
}

function getSmsSendLock(phone, purpose) {
  const item = smsSendLocks[getSmsLockKey(phone, purpose)];
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    delete smsSendLocks[getSmsLockKey(phone, purpose)];
    return null;
  }
  return item;
}

function setSmsSendLock(phone, purpose, waitSeconds, reason) {
  smsSendLocks[getSmsLockKey(phone, purpose)] = {
    expiresAt: Date.now() + waitSeconds * 1000,
    reason: reason || 'cooldown',
    waitSeconds: waitSeconds
  };
}

function clearSmsSendLock(phone, purpose) {
  delete smsSendLocks[getSmsLockKey(phone, purpose)];
}

function getActiveSmsLocks() {
  const now = Date.now();
  return Object.entries(smsSendLocks).map(function(entry) {
    const key = entry[0];
    const item = entry[1];
    if (!item || now > item.expiresAt) {
      delete smsSendLocks[key];
      return null;
    }
    const parts = key.split(':');
    return {
      key: key,
      purpose: parts[0] || 'register',
      phone: parts.slice(1).join(':'),
      reason: item.reason || 'cooldown',
      retryAfter: Math.max(1, Math.ceil((item.expiresAt - now) / 1000))
    };
  }).filter(Boolean);
}

function getActiveSmsCodes() {
  const now = Date.now();
  return Object.entries(smsCodes).map(function(entry) {
    const key = entry[0];
    const item = entry[1];
    if (!item || now > item.expiresAt) {
      delete smsCodes[key];
      return null;
    }
    const parts = key.split(':');
    return {
      key: key,
      purpose: parts[0] || 'register',
      phone: parts.slice(1).join(':'),
      code: item.code,
      expiresIn: Math.max(1, Math.ceil((item.expiresAt - now) / 1000))
    };
  }).filter(Boolean);
}

function getSmsAdminOverview() {
  return {
    provider: {
      registerConfigured: hasAliyunSmsConfig('register'),
      resetPasswordConfigured: hasAliyunSmsConfig('reset_password'),
      signName: process.env.ALIYUN_SMS_SIGN_NAME || '',
      sdkReady: !!(Dysmsapi && OpenApi && Util)
    },
    stats: {
      activeLocks: getActiveSmsLocks().length,
      activeCodes: getActiveSmsCodes().length,
      recentEvents: smsEventLogs.length
    },
    locks: getActiveSmsLocks(),
    codes: getActiveSmsCodes(),
    logs: smsEventLogs.slice(0, 20)
  };
}

function storeSmsCode(phone, purpose) {
  const code = generateSmsCode();
  smsCodes[`${purpose}:${phone}`] = {
    code: code,
    expiresAt: Date.now() + 5 * 60 * 1000
  };
  return code;
}

function verifySmsCode(phone, purpose, code) {
  const key = `${purpose}:${phone}`;
  const item = smsCodes[key];
  if (!item) return false;
  if (Date.now() > item.expiresAt) {
    delete smsCodes[key];
    return false;
  }
  return item.code === String(code || '').trim();
}

function hasAliyunSmsConfig(purpose) {
  const templateCode = purpose === 'reset_password'
    ? process.env.ALIYUN_SMS_TEMPLATE_CODE_RESET_PASSWORD
    : process.env.ALIYUN_SMS_TEMPLATE_CODE_REGISTER;
  return !!(
    process.env.ALIYUN_SMS_ACCESS_KEY_ID &&
    process.env.ALIYUN_SMS_ACCESS_KEY_SECRET &&
    process.env.ALIYUN_SMS_SIGN_NAME &&
    templateCode &&
    Dysmsapi &&
    OpenApi &&
    Util
  );
}

async function sendAliyunSms(phone, code, purpose) {
  const templateCode = purpose === 'reset_password'
    ? process.env.ALIYUN_SMS_TEMPLATE_CODE_RESET_PASSWORD
    : process.env.ALIYUN_SMS_TEMPLATE_CODE_REGISTER;
  const config = new OpenApi.Config({
    accessKeyId: process.env.ALIYUN_SMS_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIYUN_SMS_ACCESS_KEY_SECRET
  });
  config.endpoint = 'dysmsapi.aliyuncs.com';
  const client = new Dysmsapi.default(config);
  const request = new Dysmsapi.SendSmsRequest({
    phoneNumbers: phone,
    signName: process.env.ALIYUN_SMS_SIGN_NAME,
    templateCode: templateCode,
    templateParam: JSON.stringify({ code: code })
  });
  const runtime = new Util.RuntimeOptions({});
  const response = await client.sendSmsWithOptions(request, runtime);
  const body = response.body || {};
  if (body.code !== 'OK') {
    throw new Error((body.message || '短信发送失败') + (body.code ? ` [${body.code}]` : ''));
  }
  return body;
}

function formatSmsErrorMessage(message) {
  const text = String(message || '');
  if (text.includes('isv.BUSINESS_LIMIT_CONTROL')) {
    return '短信发送过于频繁，请10分钟后再试';
  }
  if (text.includes('isv.AMOUNT_NOT_ENOUGH')) {
    return '短信账户余额不足，请联系管理员处理';
  }
  if (text.includes('isv.MOBILE_NUMBER_ILLEGAL')) {
    return '手机号格式不正确';
  }
  if (text.includes('isv.TEMPLATE_MISSING_PARAMETERS')) {
    return '短信模板配置不正确，请联系管理员';
  }
  if (text.includes('isv.INVALID_PARAMETERS')) {
    return '短信配置参数无效，请联系管理员';
  }
  return '验证码发送失败，请稍后再试';
}

// 加载已保存的订单
function loadOrders() {
  if (fs.existsSync(orderFile)) {
    try {
      const data = fs.readFileSync(orderFile, 'utf8');
      Object.assign(orders, JSON.parse(data));
      console.log('已加载订单数据');
    } catch (e) {
      console.error('加载订单失败:', e);
    }
  }
}

// 保存订单到文件
function saveOrders() {
  fs.writeFileSync(orderFile, JSON.stringify(orders, null, 2));
}

// 加载征信打印点数据
let creditPrintPoints = [];
function loadCreditPrintPoints() {
  if (fs.existsSync(creditPrintPointsFile)) {
    try {
      const data = fs.readFileSync(creditPrintPointsFile, 'utf8');
      creditPrintPoints = JSON.parse(data);
      console.log('已加载征信打印点数据');
    } catch (e) {
      console.error('加载征信打印点数据失败:', e);
      // 初始化默认数据
      creditPrintPoints = [
        {
          province: 'beijing',
          city: 'beijing',
          district: 'xicheng',
          name: '中国人民银行征信中心',
          address: '北京市西城区月坛南街1号',
          phone: '010-68559137',
          hours: '周一至周五 9:00-17:00',
          type: '中国人民银行直属机构',
          business: '个人征信报告打印、企业征信报告打印、征信异议处理',
          equipment: '征信自助查询机',
          note: '需携带本人身份证原件',
          color: '#3498db',
          lastUpdated: new Date().toISOString()
        },
        {
          province: 'hunan',
          city: 'changsha',
          district: 'wangcheng',
          name: '中国人民银行长沙中心支行',
          address: '湖南省长沙市望城区金星北路一段19号',
          phone: '0731-88888888',
          hours: '周一至周五 9:00-17:00',
          type: '中国人民银行直属机构',
          business: '个人征信报告打印、企业征信报告打印、征信异议处理',
          equipment: '征信自助查询机',
          note: '需携带本人身份证原件',
          color: '#3498db',
          lastUpdated: new Date().toISOString()
        },
        {
          province: 'hunan',
          city: 'changsha',
          district: 'wangcheng',
          name: '中国建设银行长沙市望城区支行',
          address: '湖南省长沙市望城区高塘岭街道郭亮中路238号',
          phone: '0731-88066666',
          hours: '周一至周五 9:00-17:00，周六 9:00-16:00',
          type: '商业银行',
          business: '个人征信报告打印',
          equipment: '征信自助查询机',
          note: '需携带本人身份证原件',
          color: '#27ae60',
          lastUpdated: new Date().toISOString()
        },
        {
          province: 'hunan',
          city: 'changsha',
          district: 'yuelu',
          name: '中国人民银行长沙中心支行岳麓区分理处',
          address: '湖南省长沙市岳麓区岳麓大道218号',
          phone: '0731-88999999',
          hours: '周一至周五 9:00-17:00',
          type: '中国人民银行直属机构',
          business: '个人征信报告打印、企业征信报告打印、征信异议处理',
          equipment: '征信自助查询机',
          note: '需携带本人身份证原件',
          color: '#3498db',
          lastUpdated: new Date().toISOString()
        },
        {
          province: 'hunan',
          city: 'changsha',
          district: 'yuelu',
          name: '中国工商银行长沙市岳麓支行',
          address: '湖南省长沙市岳麓区麓山路123号',
          phone: '0731-88776666',
          hours: '周一至周五 9:00-17:00，周六 9:00-16:00',
          type: '商业银行',
          business: '个人征信报告打印',
          equipment: '征信自助查询机',
          note: '需携带本人身份证原件',
          color: '#f39c12',
          lastUpdated: new Date().toISOString()
        }
      ];
      saveCreditPrintPoints();
    }
  } else {
    // 初始化默认数据
    creditPrintPoints = [
      {
        province: 'beijing',
        city: 'beijing',
        district: 'xicheng',
        name: '中国人民银行征信中心',
        address: '北京市西城区月坛南街1号',
        phone: '010-68559137',
        hours: '周一至周五 9:00-17:00',
        type: '中国人民银行直属机构',
        business: '个人征信报告打印、企业征信报告打印、征信异议处理',
        equipment: '征信自助查询机',
        note: '需携带本人身份证原件',
        color: '#3498db',
        lastUpdated: new Date().toISOString()
      },
      {
        province: 'hunan',
        city: 'changsha',
        district: 'wangcheng',
        name: '中国人民银行长沙中心支行',
        address: '湖南省长沙市望城区金星北路一段19号',
        phone: '0731-88888888',
        hours: '周一至周五 9:00-17:00',
        type: '中国人民银行直属机构',
        business: '个人征信报告打印、企业征信报告打印、征信异议处理',
        equipment: '征信自助查询机',
        note: '需携带本人身份证原件',
        color: '#3498db',
        lastUpdated: new Date().toISOString()
      },
      {
        province: 'hunan',
        city: 'changsha',
        district: 'wangcheng',
        name: '中国建设银行长沙市望城区支行',
        address: '湖南省长沙市望城区高塘岭街道郭亮中路238号',
        phone: '0731-88066666',
        hours: '周一至周五 9:00-17:00，周六 9:00-16:00',
        type: '商业银行',
        business: '个人征信报告打印',
        equipment: '征信自助查询机',
        note: '需携带本人身份证原件',
        color: '#27ae60',
        lastUpdated: new Date().toISOString()
      },
      {
        province: 'hunan',
        city: 'changsha',
        district: 'yuelu',
        name: '中国人民银行长沙中心支行岳麓区分理处',
        address: '湖南省长沙市岳麓区岳麓大道218号',
        phone: '0731-88999999',
        hours: '周一至周五 9:00-17:00',
        type: '中国人民银行直属机构',
        business: '个人征信报告打印、企业征信报告打印、征信异议处理',
        equipment: '征信自助查询机',
        note: '需携带本人身份证原件',
        color: '#3498db',
        lastUpdated: new Date().toISOString()
      },
      {
        province: 'hunan',
        city: 'changsha',
        district: 'yuelu',
        name: '中国工商银行长沙市岳麓支行',
        address: '湖南省长沙市岳麓区麓山路123号',
        phone: '0731-88776666',
        hours: '周一至周五 9:00-17:00，周六 9:00-16:00',
        type: '商业银行',
        business: '个人征信报告打印',
        equipment: '征信自助查询机',
        note: '需携带本人身份证原件',
        color: '#f39c12',
        lastUpdated: new Date().toISOString()
      }
    ];
    saveCreditPrintPoints();
  }
}

// 保存征信打印点数据
function saveCreditPrintPoints() {
  fs.writeFileSync(creditPrintPointsFile, JSON.stringify(creditPrintPoints, null, 2));
}

// 模拟更新征信打印点数据（实际项目中可以调用外部API获取数据）
function updateCreditPrintPoints() {
  console.log('开始更新征信打印点数据...');
  
  // 模拟添加新的打印点
  const newPoint = {
    province: 'hunan',
    city: 'changsha',
    district: 'wangcheng',
    name: '中国工商银行长沙市望城区支行',
    address: '湖南省长沙市望城区高塘岭街道雷锋东路123号',
    phone: '0731-88123456',
    hours: '周一至周五 9:00-17:00',
    type: '商业银行',
    business: '个人征信报告打印',
    equipment: '征信自助查询机',
    note: '需携带本人身份证原件',
    color: '#f39c12',
    lastUpdated: new Date().toISOString()
  };
  
  // 检查是否已存在
  const exists = creditPrintPoints.some(point => 
    point.name === newPoint.name && point.address === newPoint.address
  );
  
  if (!exists) {
    creditPrintPoints.push(newPoint);
    saveCreditPrintPoints();
    console.log('已添加新的征信打印点:', newPoint.name);
  }
  
  // 更新现有打印点的最后更新时间
  creditPrintPoints.forEach(point => {
    point.lastUpdated = new Date().toISOString();
  });
  
  saveCreditPrintPoints();
  console.log('征信打印点数据更新完成');
}

// 定时更新征信打印点数据（每天凌晨2点更新）
function scheduleCreditPrintPointsUpdate() {
  const now = new Date();
  const nextUpdate = new Date(now);
  nextUpdate.setHours(2, 0, 0, 0);
  
  if (nextUpdate <= now) {
    nextUpdate.setDate(nextUpdate.getDate() + 1);
  }
  
  const delay = nextUpdate - now;
  
  setTimeout(() => {
    updateCreditPrintPoints();
    // 递归调用，每天执行一次
    scheduleCreditPrintPointsUpdate();
  }, delay);
  
  console.log(`下次更新征信打印点数据的时间: ${nextUpdate}`);
}

// 企业搜索模拟数据库
const enterpriseDatabase = [
  { name: '湖南晨启数字科技有限公司', creditCode: '91430100MA4R7G5X3K', legalPerson: '陈晨', address: '湖南省长沙市岳麓区' },
  { name: '银河星辰财务科技有限公司', creditCode: '91430100MA4R7G5X4L', legalPerson: '周星', address: '湖南省长沙市开福区' },
  { name: '长沙慧账财税咨询有限公司', creditCode: '91430100MA4R7G5X5M', legalPerson: '李敏', address: '湖南省长沙市雨花区' },
  { name: '湖南大科创新发展有限公司', creditCode: '91430100MA4R7G5X6N', legalPerson: '王拓', address: '湖南省长沙市天心区' },
  { name: '长沙智联数据服务有限公司', creditCode: '91430100MA4R7G5X7P', legalPerson: '钱程', address: '湖南省长沙市望城区' },
  { name: '深圳市腾讯计算机系统有限公司', creditCode: '9144030071526726XG', legalPerson: '马化腾', address: '广东省深圳市南山区' },
  { name: '阿里巴巴（中国）有限公司', creditCode: '91330100799655058B', legalPerson: '蒋芳', address: '浙江省杭州市余杭区' },
  { name: '百度在线网络技术（北京）有限公司', creditCode: '91110108717809965C', legalPerson: '李彦宏', address: '北京市海淀区' },
  { name: '华为技术有限公司', creditCode: '914403001922038216', legalPerson: '赵明路', address: '广东省深圳市龙岗区' },
  { name: '小米科技有限责任公司', creditCode: '91110108551385082Q', legalPerson: '雷军', address: '北京市海淀区' }
];

function generateCreditCode() {
  const chars = '0123456789ABCDEFGHJKLMNPQRTUWXY';
  let code = '91430100MA';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code.slice(0, 18);
}

// 微信支付工具函数
const WechatPay = {
  // 生成随机字符串
  generateNonceStr: function() {
    return Math.random().toString(36).substr(2, 15);
  },

  // 生成签名
  generateSign: function(params, apiKey) {
    const sortedKeys = Object.keys(params).sort();
    let stringA = '';
    sortedKeys.forEach(key => {
      if (params[key] !== '' && params[key] !== undefined && params[key] !== null && key !== 'sign') {
        stringA += `${key}=${params[key]}&`;
      }
    });
    const stringSignTemp = stringA + `key=${apiKey}`;
    return crypto.createHash('md5').update(stringSignTemp).digest('hex').toUpperCase();
  },

  // 验证签名
  verifySign: function(params, apiKey) {
    const sign = params.sign;
    const calculatedSign = this.generateSign(params, apiKey);
    return sign === calculatedSign;
  },

  // XML转JSON
  xmlToJson: function(xml) {
    const result = {};
    const regex = /<([^>]+)>([^<]*)<\/[^>]+>/g;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      result[match[1]] = match[2];
    }
    return result;
  },

  // JSON转XML
  jsonToXml: function(obj) {
    let xml = '<xml>';
    for (const key in obj) {
      xml += `<${key}><![CDATA[${obj[key]}]]></${key}>`;
    }
    xml += '</xml>';
    return xml;
  }
};

// 支付宝支付工具函数
const Alipay = {
  // 生成签名
  generateSign: function(params, privateKey) {
    const sortedKeys = Object.keys(params).sort();
    let stringToSign = '';
    sortedKeys.forEach((key, index) => {
      if (params[key] !== '' && params[key] !== undefined && params[key] !== null && key !== 'sign' && key !== 'sign_type') {
        if (index > 0) stringToSign += '&';
        stringToSign += `${key}=${params[key]}`;
      }
    });
    
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(stringToSign);
    return sign.sign(privateKey, 'base64');
  },

  // 验证签名
  verifySign: function(params, publicKey) {
    const sign = params.sign;
    const signType = params.sign_type;
    
    // 移除签名字段
    const paramsToSign = { ...params };
    delete paramsToSign.sign;
    delete paramsToSign.sign_type;
    
    // 按字母排序
    const sortedKeys = Object.keys(paramsToSign).sort();
    let stringToSign = '';
    sortedKeys.forEach((key, index) => {
      if (index > 0) stringToSign += '&';
      stringToSign += `${key}=${paramsToSign[key]}`;
    });
    
    try {
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(stringToSign);
      
      // 格式化公钥
      let formattedKey = publicKey;
      if (!formattedKey.includes('-----BEGIN PUBLIC KEY-----')) {
        formattedKey = '-----BEGIN PUBLIC KEY-----\n' + formattedKey + '\n-----END PUBLIC KEY-----';
      }
      
      return verify.verify(formattedKey, sign, 'base64');
    } catch (e) {
      console.error('支付宝签名验证失败:', e);
      return false;
    }
  }
};

// 调用微信支付API
function callWechatAPI(apiPath, xmlBody) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.mch.weixin.qq.com',
      port: 443,
      path: apiPath,
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'Content-Length': Buffer.byteLength(xmlBody, 'utf8')
      }
    };
    const wxReq = https.request(options, (wxRes) => {
      let responseData = '';
      wxRes.on('data', chunk => { responseData += chunk; });
      wxRes.on('end', () => resolve(responseData));
    });
    wxReq.on('error', reject);
    wxReq.write(xmlBody);
    wxReq.end();
  });
}

// 加载订单数据
loadOrders();

// 加载征信打印点数据
loadCreditPrintPoints();

// 启动定时更新任务
scheduleCreditPrintPointsUpdate();

// 创建服务器
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  // 静态文件服务
  if (req.method === 'GET' && !pathname.startsWith('/api')) {
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : decodeURIComponent(pathname));
    
    // 安全检查
    if (!filePath.startsWith(__dirname)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }
    
    const extname = path.extname(filePath);
    const contentType = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.md': 'text/markdown',
      '.txt': 'text/plain'
    }[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
      if (error) {
        if (error.code === 'ENOENT') {
          res.statusCode = 404;
          res.end('File not found');
        } else {
          res.statusCode = 500;
          res.end('Server Error');
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
    return;
  }

  // API端点处理
  if (pathname === '/api/create_payment' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString('utf8');
    });
    req.on('end', () => {
      try {
        console.log('接收到的body:', body);
        console.log('body类型:', typeof body);
        let data = body;
        if (typeof data === 'string' && data) {
          data = JSON.parse(data);
        }
        console.log('解析后的数据:', data);
        
        const orderId = data.orderId || 'ORDER_' + Date.now();
        orders[orderId] = {
          orderId,
          amount: data.amount,
          description: data.description,
          paymentMethod: data.paymentMethod,
          status: 'pending',
          createTime: new Date().toISOString(),
          updateTime: new Date().toISOString()
        };
        
        saveOrders();
        console.log(`创建订单: ${orderId}, 金额: ${data.amount / 100}元, 方式: ${data.paymentMethod}`);

        let payParams = {};
        if (data.paymentMethod === 'wechat') {
          // 测试模式：模拟微信支付二维码
          const mockCodeUrl = 'weixin://wxpay/bizpayurl?pr=TEST' + Date.now();
          payParams = {
            code_url: mockCodeUrl,
            appId: paymentConfig.wechat.appId,
            timeStamp: Math.floor(Date.now() / 1000).toString(),
            nonceStr: Math.random().toString(36).substr(2, 9),
            package: 'prepay_id=mock_' + orderId,
            signType: 'MD5',
            paySign: 'test_sign'
          };
        } else if (data.paymentMethod === 'alipay') {
          const bizContent = {
            out_trade_no: orderId,
            product_code: 'FAST_INSTANT_TRADE_PAY',
            total_amount: (data.amount / 100).toFixed(2),
            subject: data.description
          };
          
          const host = req.headers.host || 'localhost:3000';
          const protocol = (host.startsWith('localhost') || host.match(/^\d+\.\d+\.\d+\.\d+/)) ? 'http' : 'https';
          const returnUrl = `${protocol}://${host}/payment.html?status=alipay_return&orderId=${encodeURIComponent(orderId)}`;
          payParams = {
            app_id: paymentConfig.alipay.appId,
            method: 'alipay.trade.page.pay',
            charset: 'UTF-8',
            sign_type: 'RSA2',
            timestamp: new Date().toISOString().replace(/T/, ' ').substr(0, 19),
            version: '1.0',
            notify_url: paymentConfig.alipay.notifyUrl,
            return_url: returnUrl,
            biz_content: JSON.stringify(bizContent)
          };
          
          payParams.sign = Alipay.generateSign(payParams, paymentConfig.alipay.privateKey);
        } else if (data.paymentMethod === 'transfer') {
          payParams = {
            message: '请转账到对公账户，转账完成后联系客服确认'
          };
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: true,
          data: payParams,
          orderId: orderId
        }));
      } catch (error) {
        console.error('创建支付失败:', error);
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: false,
          message: 'Invalid request data'
        }));
      }
    });
  } else if (pathname === '/api/query_payment' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString('utf8');
    });
    req.on('end', () => {
      try {
        let data = body;
        if (typeof data === 'string' && data) {
          data = JSON.parse(data);
        }
        const order = orders[data.orderId];

        if (order) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            success: true,
            data: order
          }));
        } else {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            success: false,
            message: 'Order not found'
          }));
        }
      } catch (error) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: false,
          message: 'Invalid request data'
        }));
      }
    });
  } else if (pathname === '/api/wechat/notify' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString('utf8');
    });
    req.on('end', () => {
      console.log('收到微信支付回调:', body);
      
      try {
        const params = WechatPay.xmlToJson(body);
        
        if (WechatPay.verifySign(params, paymentConfig.wechat.apiKey)) {
          const orderId = params.out_trade_no;
          const transactionId = params.transaction_id;
          
          if (orders[orderId]) {
            orders[orderId].status = 'paid';
            orders[orderId].transactionId = transactionId;
            orders[orderId].updateTime = new Date().toISOString();
            orders[orderId].wechatNotify = params;
            saveOrders();
            
            console.log(`微信支付成功: 订单 ${orderId}, 交易号 ${transactionId}`);
          }
          
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/xml');
          res.end(WechatPay.jsonToXml({
            return_code: 'SUCCESS',
            return_msg: 'OK'
          }));
        } else {
          console.error('微信支付签名验证失败');
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/xml');
          res.end(WechatPay.jsonToXml({
            return_code: 'FAIL',
            return_msg: '签名验证失败'
          }));
        }
      } catch (error) {
        console.error('处理微信支付回调失败:', error);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/xml');
        res.end(WechatPay.jsonToXml({
          return_code: 'FAIL',
          return_msg: '处理失败'
        }));
      }
    });
  } else if (pathname === '/api/alipay/notify' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString('utf8');
    });
    req.on('end', () => {
      console.log('收到支付宝回调:', body);
      
      try {
        const params = querystring.parse(body);
        
        if (Alipay.verifySign(params, paymentConfig.alipay.publicKey)) {
          const orderId = params.out_trade_no;
          const tradeNo = params.trade_no;
          const tradeStatus = params.trade_status;
          
          if (orders[orderId] && (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED')) {
            orders[orderId].status = 'paid';
            orders[orderId].transactionId = tradeNo;
            orders[orderId].updateTime = new Date().toISOString();
            orders[orderId].alipayNotify = params;
            saveOrders();
            
            console.log(`支付宝支付成功: 订单 ${orderId}, 交易号 ${tradeNo}`);
          }
          
          res.statusCode = 200;
          res.end('success');
        } else {
          console.error('支付宝签名验证失败');
          res.statusCode = 400;
          res.end('fail');
        }
      } catch (error) {
        console.error('处理支付宝回调失败:', error);
        res.statusCode = 400;
        res.end('fail');
      }
    });
  } else if (pathname === '/api/orders' && req.method === 'GET') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      success: true,
      data: Object.values(orders)
    }));
  } else if (pathname === '/api/credit-print-points' && req.method === 'GET') {
    const province = parsedUrl.query.province;
    const city = parsedUrl.query.city;
    const district = parsedUrl.query.district;
    
    let filteredPoints = creditPrintPoints;
    
    if (province) {
      filteredPoints = filteredPoints.filter(point => point.province === province);
    }
    
    if (city) {
      filteredPoints = filteredPoints.filter(point => point.city === city);
    }
    
    if (district) {
      filteredPoints = filteredPoints.filter(point => point.district === district);
    }
    
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      success: true,
      data: filteredPoints,
      lastUpdated: new Date().toISOString()
    }));
  } else if (pathname === '/api/credit-print-points/update' && req.method === 'POST') {
    updateCreditPrintPoints();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      success: true,
      message: '征信打印点数据更新成功'
    }));

  } else if (pathname === '/api/enterprise/search' && req.method === 'GET') {
    try {
      const keyword = String(parsedUrl.query.keyword || '').trim();
      if (!keyword || keyword.length < 2) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, data: [] }));
        return;
      }

      const normalizedKeyword = keyword.toLowerCase();
      const results = enterpriseDatabase.filter(ent =>
        ent.name.toLowerCase().includes(normalizedKeyword) ||
        ent.creditCode.toLowerCase().includes(normalizedKeyword)
      ).slice(0, 10);

      if (results.length === 0) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: true,
          data: [{
            name: keyword + '有限公司',
            creditCode: generateCreditCode(),
            legalPerson: '待确认',
            address: '请联系管理员补充企业注册地址'
          }],
          note: '未找到精确匹配，已返回智能联想结果'
        }));
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: results }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '企业搜索失败: ' + e.message }));
    }

  } else if (pathname === '/api/sms/send-code' && req.method === 'POST') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', async function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.phone || !/^1[3-9]\d{9}$/.test(data.phone)) {
          addSmsEventLog({ phone: data.phone || '', purpose: data.purpose || 'register', status: 'invalid_phone', detail: '手机号格式不正确' });
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '手机号格式不正确' }));
          return;
        }
        const purpose = data.purpose || 'register';
        const existingLock = getSmsSendLock(data.phone, purpose);
        if (existingLock) {
          addSmsEventLog({ phone: data.phone, purpose: purpose, status: existingLock.reason, detail: '命中短信发送限制' });
          res.statusCode = 429;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            success: false,
            message: existingLock.reason === 'provider_limit'
              ? '短信发送过于频繁，请10分钟后再试'
              : `请求过于频繁，请${existingLock.waitSeconds}秒后再试`,
            retryAfter: existingLock.waitSeconds,
            reason: existingLock.reason
          }));
          return;
        }

        setSmsSendLock(data.phone, purpose, 60, 'cooldown');
        const code = storeSmsCode(data.phone, purpose);
        if (hasAliyunSmsConfig(purpose)) {
          try {
            await sendAliyunSms(data.phone, code, purpose);
            addSmsEventLog({ phone: data.phone, purpose: purpose, status: 'sent', detail: '短信发送成功' });
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true, message: '验证码已发送到您的手机', mode: 'aliyun' }));
            return;
          } catch (e) {
            if (String(e.message || '').includes('isv.BUSINESS_LIMIT_CONTROL')) {
              setSmsSendLock(data.phone, purpose, 600, 'provider_limit');
            } else {
              clearSmsSendLock(data.phone, purpose);
            }
            addSmsEventLog({ phone: data.phone, purpose: purpose, status: 'send_failed', detail: String(e.message || '短信发送失败') });
            throw e;
          }
        }
        console.log(`短信验证码[${purpose}] ${data.phone}: ${code}`);
        addSmsEventLog({ phone: data.phone, purpose: purpose, status: 'debug_code', detail: '测试模式生成验证码' });
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: true,
          mode: 'debug',
          message: '验证码已生成，当前为测试模式，请联系管理员接入阿里云短信配置',
          debugCode: code
        }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: formatSmsErrorMessage(e.message), detail: e.message }));
      }
    });

  } else if (pathname === '/api/users/reset-password' && req.method === 'POST') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', function() {
      try {
        if (!usersDb) throw new Error('用户数据库未初始化');
        const data = JSON.parse(body || '{}');
        if (!data.phone || !data.code || !data.password) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '手机号、验证码、新密码不能为空' }));
          return;
        }
        if (!verifySmsCode(data.phone, 'reset_password', data.code)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '验证码错误或已过期' }));
          return;
        }
        const exists = usersDb.prepare('SELECT id FROM users WHERE phone = ?').get(data.phone);
        if (!exists) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '该手机号未注册' }));
          return;
        }
        usersDb.prepare('UPDATE users SET password = ?, update_time = ? WHERE phone = ?')
          .run(data.password, new Date().toISOString(), data.phone);
        delete smsCodes[`reset_password:${data.phone}`];
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '密码重置成功' }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '密码重置失败: ' + e.message }));
      }
    });

  } else if (pathname === '/api/admin/users' && req.method === 'GET') {
    try {
      if (!usersDb) {
        // 数据库未初始化时返回空数据
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: true,
          data: {
            total: 0,
            users: []
          },
          message: '数据库服务未启动，请检查 better-sqlite3 是否正确安装'
        }));
        return;
      }
      const users = usersDb.prepare('SELECT id, phone, user_type, institution_type, institution_name, create_time, sync_status, last_sync_time FROM users ORDER BY create_time DESC').all();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        success: true,
        data: {
          total: users.length,
          users: users
        }
      }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '获取注册用户失败: ' + e.message }));
    }

  } else if (pathname === '/api/admin/sms' && req.method === 'GET') {
    try {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: getSmsAdminOverview() }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '获取短信管理数据失败: ' + e.message }));
    }

  } else if (pathname === '/api/admin/sms/unlock' && req.method === 'POST') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.phone) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '手机号不能为空' }));
          return;
        }
        const purpose = data.purpose || 'register';
        clearSmsSendLock(data.phone, purpose);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '短信限制已解除' }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '解除短信限制失败: ' + e.message }));
      }
    });

  } else if (pathname === '/api/admin/sms/codes/clear' && req.method === 'POST') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.phone) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '手机号不能为空' }));
          return;
        }
        const purpose = data.purpose || 'register';
        delete smsCodes[`${purpose}:${data.phone}`];
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '验证码缓存已清除' }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '清除验证码缓存失败: ' + e.message }));
      }
    });

  } else if (pathname === '/api/users/register' && req.method === 'POST') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', function() {
      try {
        if (!usersDb) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '用户数据库未初始化' }));
          return;
        }
        const data = JSON.parse(body || '{}');
        if (!data.phone || !data.password || !data.userType) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '手机号、密码、用户类型为必填项' }));
          return;
        }
        const exists = usersDb.prepare('SELECT id FROM users WHERE phone = ?').get(data.phone);
        if (exists) {
          res.statusCode = 409;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '该手机号已注册' }));
          return;
        }
        const userId = 'USER_' + Date.now();
        const now = new Date().toISOString();
        const user = {
          id: userId,
          phone: data.phone,
          password: data.password,
          user_type: data.userType,
          institution_type: data.institutionType || '',
          institution_name: data.institutionName || '',
          credit_code: data.creditCode || '',
          contact_person: data.contactPerson || '',
          industry: data.industry || '',
          create_time: now,
          update_time: now
        };
        const syncInfo = syncUserProfile(user);
        usersDb.prepare('INSERT INTO users (id, phone, password, user_type, institution_type, institution_name, credit_code, contact_person, industry, create_time, update_time, local_db_file, cloud_backup_file, sync_status, last_sync_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(user.id, user.phone, user.password, user.user_type, user.institution_type, user.institution_name, user.credit_code, user.contact_person, user.industry, user.create_time, user.update_time, syncInfo.localDbFile, syncInfo.cloudBackupFile, syncInfo.syncStatus, syncInfo.lastSyncTime);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: true,
          data: {
            id: user.id,
            phone: user.phone,
            userType: user.user_type,
            localDbFile: syncInfo.localDbFile,
            cloudBackupFile: syncInfo.cloudBackupFile,
            syncStatus: syncInfo.syncStatus,
            lastSyncTime: syncInfo.lastSyncTime
          },
          message: '注册成功，已自动建立本地数据库并完成云端备份'
        }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '注册失败: ' + e.message }));
      }
    });

  } else if (pathname === '/api/users/login' && req.method === 'POST') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', function() {
      try {
        if (!usersDb) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '用户数据库未初始化' }));
          return;
        }
        const data = JSON.parse(body || '{}');
        if (!data.account || !data.password) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '账号和密码不能为空' }));
          return;
        }
        const account = String(data.account || '').trim();
        if (!isPhoneAccount(account)) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '当前版本仅支持手机号登录，请输入注册手机号' }));
          return;
        }
        const userByPhone = usersDb.prepare('SELECT * FROM users WHERE phone = ?').get(account);
        if (!userByPhone) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '该手机号未注册，请先注册' }));
          return;
        }
        if (userByPhone.password !== data.password) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '密码错误，请重新输入' }));
          return;
        }
        const user = userByPhone;
        const syncInfo = syncUserProfile(user);
        usersDb.prepare('UPDATE users SET local_db_file = ?, cloud_backup_file = ?, sync_status = ?, last_sync_time = ?, update_time = ? WHERE id = ?')
          .run(syncInfo.localDbFile, syncInfo.cloudBackupFile, syncInfo.syncStatus, syncInfo.lastSyncTime, new Date().toISOString(), user.id);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: true,
          data: {
            id: user.id,
            phone: user.phone,
            userType: user.user_type,
            institutionType: user.institution_type || '',
            institutionName: user.institution_name || '',
            industry: user.industry || '',
            localDbFile: syncInfo.localDbFile,
            cloudBackupFile: syncInfo.cloudBackupFile,
            syncStatus: syncInfo.syncStatus,
            lastSyncTime: syncInfo.lastSyncTime,
            isLoggedIn: true,
            currentUserDb: syncInfo.localDbFile
          },
          message: '登录成功，当前用户数据库已绑定并完成同步'
        }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '登录失败: ' + e.message }));
      }
    });

  } else if (pathname.match(/^\/api\/users\/[^/]+\/sync$/) && req.method === 'POST') {
    const userId = pathname.split('/')[3];
    try {
      if (!usersDb) throw new Error('用户数据库未初始化');
      const user = usersDb.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      if (!user) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '用户不存在' }));
        return;
      }
      const syncInfo = syncUserProfile(user);
      usersDb.prepare('UPDATE users SET local_db_file = ?, cloud_backup_file = ?, sync_status = ?, last_sync_time = ?, update_time = ? WHERE id = ?')
        .run(syncInfo.localDbFile, syncInfo.cloudBackupFile, syncInfo.syncStatus, syncInfo.lastSyncTime, new Date().toISOString(), userId);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, message: '本地与云端同步完成', data: syncInfo }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '同步失败: ' + e.message }));
    }

  // ============================================================
  // 账套管理 API
  // ============================================================

  // 创建账套：POST /api/accounts
  } else if (pathname === '/api/accounts' && req.method === 'POST') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', function() {
      try {
        const data = JSON.parse(body);
        if (!data.name || !data.industry || !data.startDate || !data.userId) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '账套名称、行业、开始日期、用户ID为必填项' }));
          return;
        }

        const accountId = 'ACCT_' + Date.now();
        const now = new Date().toISOString();

        // 1. 为该账套创建独立的SQLite数据库文件
        const dbFile = initAccountDb(accountId);

        // 2. 将账套元信息写入主数据库
        let savedToDb = false;
        if (mainDb) {
          try {
            const stmt = mainDb.prepare(
              'INSERT INTO accounts (id, user_id, name, industry, start_date, accounting_system, create_time, update_time, db_file) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            stmt.run(
              accountId,
              data.userId,
              data.name,
              data.industry,
              data.startDate,
              data.accountingSystem || '小企业会计准则',
              now,
              now,
              dbFile || ''
            );
            savedToDb = true;
          } catch (dbErr) {
            console.error('写入主数据库失败:', dbErr.message);
          }
        }

        const newAccount = {
          id: accountId,
          user_id: data.userId,
          name: data.name,
          industry: data.industry,
          start_date: data.startDate,
          accounting_system: data.accountingSystem || '小企业会计准则',
          create_time: now,
          update_time: now,
          db_file: dbFile || '',
          savedToDb: savedToDb
        };

        // 3. 触发云端备份
        const backupFile = cloudBackupAccount(newAccount);

        // 4. 更新主数据库中的备份时间
        if (mainDb && savedToDb && backupFile) {
          try {
            mainDb.prepare('UPDATE accounts SET last_backup_time = ? WHERE id = ?').run(now, accountId);
          } catch (e) {}
        }

        console.log('账套创建成功:', accountId, data.name);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: true,
          data: newAccount,
          message: '账套创建成功，本地数据库和云端备份已完成'
        }));
      } catch (e) {
        console.error('创建账套失败:', e.message);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '创建账套失败: ' + e.message }));
      }
    });

  // 获取所有账套：GET /api/accounts
  } else if (pathname === '/api/accounts' && req.method === 'GET') {
    const userId = parsedUrl.query.userId;
    if (mainDb) {
      try {
        if (!userId) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '缺少用户ID参数' }));
          return;
        }
        let accounts = mainDb.prepare('SELECT * FROM accounts WHERE status = ? AND user_id = ? ORDER BY create_time DESC').all('active', userId);
        let repairedDbFiles = 0;
        accounts = accounts.map(function(account) {
          const normalizedDbFile = getNormalizedAccountDbFile(account.id, account.db_file);
          if (normalizedDbFile !== account.db_file) {
            mainDb.prepare('UPDATE accounts SET db_file = ?, update_time = ? WHERE id = ?')
              .run(normalizedDbFile, new Date().toISOString(), account.id);
            repairedDbFiles++;
            return { ...account, db_file: normalizedDbFile };
          }
          return account;
        });
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, data: accounts, repairedDbFiles: repairedDbFiles }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '查询账套失败: ' + e.message }));
      }
    } else {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '数据库未初始化' }));
    }

  } else if (pathname.match(/^\/api\/accounts\/[^/]+\/opening-balances\/status$/) && req.method === 'GET') {
    const accountId = pathname.split('/')[3];
    const db = getAccountDb(accountId);
    if (!db) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '账套数据库不存在' }));
      return;
    }
    try {
      db.exec(`CREATE TABLE IF NOT EXISTS opening_balances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        account_code TEXT UNIQUE NOT NULL,
        account_name TEXT NOT NULL,
        direction TEXT NOT NULL,
        amount REAL DEFAULT 0,
        auxiliary TEXT,
        create_time TEXT NOT NULL,
        update_time TEXT NOT NULL
      )`);
      const summary = db.prepare('SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN ABS(amount) > 0.0001 THEN 1 ELSE 0 END), 0) AS filled FROM opening_balances').get();
      const filled = Number(summary.filled || 0);
      const hasOpeningBalance = filled > 0;
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        success: true,
        data: {
          hasOpeningBalance: hasOpeningBalance,
          filledCount: filled,
          totalCount: Number(summary.total || 0)
        }
      }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '查询期初状态失败: ' + e.message }));
    }

  // 获取期初余额：GET /api/accounts/:id/opening-balances
  } else if (pathname.match(/^\/api\/accounts\/[^/]+\/opening-balances$/) && req.method === 'GET') {
    const accountId = pathname.split('/')[3];
    const db = getAccountDb(accountId);
    if (!db) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '账套数据库不存在' }));
      return;
    }
    try {
      const rows = db.prepare('SELECT account_code, account_name, direction, amount, auxiliary FROM opening_balances ORDER BY account_code').all();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: rows }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '查询期初余额失败: ' + e.message }));
    }

  // 保存期初余额：POST /api/accounts/:id/opening-balances
  } else if (pathname.match(/^\/api\/accounts\/[^/]+\/opening-balances$/) && req.method === 'POST') {
    const accountId = pathname.split('/')[3];
    const db = getAccountDb(accountId);
    if (!db) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '账套数据库不存在' }));
      return;
    }
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', function() {
      try {
        const data = JSON.parse(body || '{}');
        const rows = Array.isArray(data.rows) ? data.rows : [];
        const now = new Date().toISOString();
        const del = db.prepare('DELETE FROM opening_balances');
        const insert = db.prepare('INSERT INTO opening_balances (account_code, account_name, direction, amount, auxiliary, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const trx = db.transaction(function() {
          del.run();
          rows.forEach(function(row) {
            insert.run(row.account_code, row.account_name, row.direction, Number(row.amount || 0), row.auxiliary || '', now, now);
          });
        });
        trx();
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '期初余额保存成功' }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '保存期初余额失败: ' + e.message }));
      }
    });

  // 获取凭证列表：GET /api/accounts/:id/vouchers
  } else if (pathname.match(/^\/api\/accounts\/[^/]+\/vouchers$/) && req.method === 'GET') {
    const accountId = pathname.split('/')[3];
    const db = getAccountDb(accountId);
    if (!db) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '账套数据库不存在' }));
      return;
    }
    try {
      const vouchers = db.prepare('SELECT * FROM vouchers ORDER BY date DESC, id DESC').all();
      const entryStmt = db.prepare('SELECT summary, account_code, account_name, debit_amount, credit_amount FROM voucher_entries WHERE voucher_id = ? ORDER BY id ASC');
      const data = vouchers.map(function(voucher) {
        return {
          ...voucher,
          entries: entryStmt.all(voucher.id)
        };
      });
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: data }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '查询凭证失败: ' + e.message }));
    }

  // 保存凭证：POST /api/accounts/:id/vouchers
  } else if (pathname.match(/^\/api\/accounts\/[^/]+\/vouchers$/) && req.method === 'POST') {
    const accountId = pathname.split('/')[3];
    const db = getAccountDb(accountId);
    if (!db) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '账套数据库不存在' }));
      return;
    }
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', function() {
      try {
        const data = JSON.parse(body || '{}');
        const now = new Date().toISOString();
        const entries = Array.isArray(data.entries) ? data.entries : [];
        const insertVoucher = db.prepare('INSERT INTO vouchers (voucher_no, voucher_type, date, summary, debit_account, credit_account, amount, attachments, creator, auditor, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        const insertEntry = db.prepare('INSERT INTO voucher_entries (voucher_id, entry_type, account_code, account_name, summary, debit_amount, credit_amount) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const trx = db.transaction(function() {
          const result = insertVoucher.run(
            data.voucherNo || '',
            data.voucherType || '记账凭证',
            data.date || now.slice(0, 10),
            data.summary || '',
            data.debitAccount || '',
            data.creditAccount || '',
            Number(data.amount || 0),
            Number(data.attachments || 0),
            data.creator || '',
            data.auditor || '',
            'saved',
            now,
            now
          );
          entries.forEach(function(entry) {
            const codeAndName = String(entry.account || '').trim().split(/\s+/);
            const accountCode = codeAndName.shift() || '';
            const accountName = codeAndName.join(' ') || entry.account || '';
            insertEntry.run(
              result.lastInsertRowid,
              Number(entry.debit || 0) > 0 ? 'debit' : 'credit',
              accountCode,
              accountName,
              entry.summary || '',
              Number(entry.debit || 0),
              Number(entry.credit || 0)
            );
          });
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, data: { id: result.lastInsertRowid }, message: '凭证保存成功' }));
        });
        trx();
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '保存凭证失败: ' + e.message }));
      }
    });

  // 获取当前账套：GET /api/accounts/current?id=ACCT_xxx
  } else if (pathname === '/api/accounts/current' && req.method === 'GET') {
    const accountId = parsedUrl.query.id;
    if (mainDb && accountId) {
      try {
        const account = mainDb.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
        if (account) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, data: account }));
        } else {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '账套不存在' }));
        }
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '查询失败: ' + e.message }));
      }
    } else {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '缺少账套ID参数' }));
    }

  // 删除账套（软删除）：DELETE /api/accounts/:id
  } else if (pathname.startsWith('/api/accounts/') && req.method === 'DELETE') {
    const accountId = pathname.replace('/api/accounts/', '');
    if (mainDb && accountId) {
      try {
        mainDb.prepare('UPDATE accounts SET status = ?, update_time = ? WHERE id = ?')
          .run('deleted', new Date().toISOString(), accountId);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '账套已删除' }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '删除失败: ' + e.message }));
      }
    } else {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '缺少账套ID' }));
    }

  // 手动触发账套云端备份：POST /api/accounts/:id/backup
  } else if (pathname.match(/^\/api\/accounts\/[^/]+\/backup$/) && req.method === 'POST') {
    const accountId = pathname.split('/')[3];
    if (mainDb && accountId) {
      try {
        const account = mainDb.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId);
        if (account) {
          const backupFile = cloudBackupAccount(account);
          mainDb.prepare('UPDATE accounts SET last_backup_time = ? WHERE id = ?')
            .run(new Date().toISOString(), accountId);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, message: '云端备份完成', backupFile: backupFile }));
        } else {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '账套不存在' }));
        }
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '备份失败: ' + e.message }));
      }
    } else {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '缺少账套ID' }));
    }

  } else {
    const filePath = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
    const fullPath = path.join(__dirname, filePath);
    
    fs.readFile(fullPath, (err, data) => {
      if (err) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: false,
          message: 'Not found'
        }));
      } else {
        const ext = path.extname(fullPath);
        const contentType = {
          '.html': 'text/html',
          '.js': 'application/javascript',
          '.css': 'text/css',
          '.json': 'application/json',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.gif': 'image/gif',
          '.md': 'text/markdown',
          '.txt': 'text/plain'
        }[ext] || 'application/octet-stream';
        
        res.statusCode = 200;
        res.setHeader('Content-Type', contentType);
        res.end(data);
      }
    });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`支付服务器已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`========================================`);
  console.log(`API端点:`);
  console.log(`  POST /api/create_payment      - 创建支付订单`);
  console.log(`  POST /api/query_payment        - 查询支付状态`);
  console.log(`  POST /api/wechat/notify        - 微信支付回调`);
  console.log(`  POST /api/alipay/notify        - 支付宝回调`);
  console.log(`  GET  /api/orders               - 获取所有订单`);
  console.log(`  POST /api/accounts             - 创建账套(自动建库+云备份)`);
  console.log(`  POST /api/users/register       - 用户注册(本地建库+云端备份)`);
  console.log(`  POST /api/users/login          - 用户登录(绑定当前用户数据库)`);
  console.log(`  POST /api/users/:id/sync       - 用户数据本地云端同步`);
  console.log(`  GET  /api/accounts             - 获取所有账套`);
  console.log(`  GET  /api/accounts/current     - 获取指定账套`);
  console.log(`  DELETE /api/accounts/:id       - 删除账套`);
  console.log(`  POST /api/accounts/:id/backup  - 手动触发云备份`);
  console.log(`========================================\n`);
});
