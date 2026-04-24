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
// 蜻蜓Chat 内存存储（备用方案）
// ============================================================
const dragonflyMemoryStore = {
  groups: [],
  circles: [],
  groupMembers: {},
  circleMembers: {},
  messages: []
};

// ============================================================
// MySQL数据库连接（阿里云RDS）
// ============================================================
let mysql = null;
let mysqlPool = null;

try {
  mysql = require('mysql2/promise');
  console.log('MySQL2 模块加载成功');
} catch (e) {
  console.warn('mysql2 未安装，将使用SQLite本地数据库:', e.message);
}

// MySQL连接池初始化
async function initMySQL() {
  if (!mysql) {
    console.log('MySQL模块未加载，跳过MySQL初始化');
    return false;
  }

    const mysqlConfig = {
    host: 'rm-bp1t731ujc98jo9c10o.mysql.rds.aliyuncs.com',
    port: 3306,
    database: 'rds_dingding',
    user: 'ram_dingding',
    password: 'h5J5BVEXtrjKVDSxmS4w',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    timezone: '+08:00'
  };

  if (!mysqlConfig.host || !mysqlConfig.database || !mysqlConfig.user) {
    console.log('MySQL配置不完整，跳过MySQL初始化');
    return false;
  }

  try {
    mysqlPool = mysql.createPool(mysqlConfig);

    // 测试连接
    const conn = await mysqlPool.getConnection();
    console.log('MySQL数据库连接成功:', mysqlConfig.host, '/', mysqlConfig.database);
    conn.release();

    // 创建表结构
    await createMySQLTables();
    return true;
  } catch (e) {
    console.error('MySQL连接失败:', e.message);
    mysqlPool = null;
    return false;
  }
}

// 创建MySQL表结构
async function createMySQLTables() {
  if (!mysqlPool) return;

  const conn = await mysqlPool.getConnection();
  try {
      // 用户表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        username VARCHAR(100),
        phone VARCHAR(20) NOT NULL,
        password VARCHAR(255) NOT NULL,
        user_type VARCHAR(20) NOT NULL,
        institution_type VARCHAR(50),
        institution_name VARCHAR(200),
        enterprise_name VARCHAR(200),
        credit_code VARCHAR(50),
        contact_person VARCHAR(50),
        industry VARCHAR(50),
        local_db_file VARCHAR(255),
        cloud_backup_file VARCHAR(255),
        sync_status VARCHAR(20) DEFAULT 'synced',
        last_sync_time DATETIME,
        member_points INT DEFAULT 0,
        member_expiry DATE,
        credit_score INT DEFAULT 0,
        account_balance DECIMAL(10,2) DEFAULT 0,
        exclusive_services INT DEFAULT 0,
        ban_status VARCHAR(20) DEFAULT 'normal',
        ban_reason TEXT,
        ban_start_time DATETIME,
        ban_end_time DATETIME,
        create_time DATETIME NOT NULL,
        update_time DATETIME NOT NULL,
        INDEX idx_phone (phone),
        INDEX idx_username (username),
        INDEX idx_user_type (user_type),
        INDEX idx_ban_status (ban_status),
        UNIQUE INDEX idx_personal_phone (phone, user_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 账套表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS accounts (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64),
        name VARCHAR(100) NOT NULL,
        industry VARCHAR(50) NOT NULL,
        start_date DATE NOT NULL,
        accounting_system VARCHAR(50) NOT NULL,
        create_time DATETIME NOT NULL,
        update_time DATETIME NOT NULL,
        status VARCHAR(20) DEFAULT 'active',
        last_backup_time DATETIME,
        db_file VARCHAR(255),
        INDEX idx_user_id (user_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 管理员通知表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS admin_notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        create_time DATETIME NOT NULL,
        status VARCHAR(20) DEFAULT 'unread'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 商品表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(50),
        name VARCHAR(200) NOT NULL,
        category VARCHAR(50),
        unit VARCHAR(20),
        price DECIMAL(10,2) DEFAULT 0,
        stock INT DEFAULT 0,
        threshold INT DEFAULT 10,
        user_id VARCHAR(64) NOT NULL,
        create_time DATETIME NOT NULL,
        update_time DATETIME NOT NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 送货单表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS delivery_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_no VARCHAR(50) NOT NULL,
        customer_name VARCHAR(100) NOT NULL,
        project_name VARCHAR(100),
        customer_phone VARCHAR(20),
        customer_address VARCHAR(255),
        contact_name VARCHAR(50),
        remark TEXT,
        delivery_date DATE NOT NULL,
        total_amount DECIMAL(10,2) DEFAULT 0,
        status VARCHAR(20) DEFAULT 'pending',
        user_id VARCHAR(64) NOT NULL,
        create_time DATETIME NOT NULL,
        update_time DATETIME NOT NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_order_no (order_no),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    // 兼容旧表：添加新字段
    try { await conn.execute(`ALTER TABLE delivery_orders ADD COLUMN contact_name VARCHAR(50)`); } catch(e) {}
    try { await conn.execute(`ALTER TABLE delivery_orders ADD COLUMN remark TEXT`); } catch(e) {}
    try { await conn.execute(`ALTER TABLE delivery_orders ADD COLUMN project_name VARCHAR(100)`); } catch(e) {}

    // 送货单明细表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS delivery_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        delivery_id INT NOT NULL,
        product_name VARCHAR(200) NOT NULL,
        model VARCHAR(100),
        length VARCHAR(50),
        wattage VARCHAR(50),
        brightness VARCHAR(50),
        sensor_mode VARCHAR(50),
        quantity DECIMAL(10,2) DEFAULT 1,
        unit VARCHAR(20),
        unit_price DECIMAL(10,2) DEFAULT 0,
        amount DECIMAL(10,2) DEFAULT 0,
        remark TEXT,
        INDEX idx_delivery_id (delivery_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    // 兼容旧表：添加新字段
    try { await conn.execute(`ALTER TABLE delivery_items ADD COLUMN model VARCHAR(100)`); } catch(e) {}
    try { await conn.execute(`ALTER TABLE delivery_items ADD COLUMN length VARCHAR(50)`); } catch(e) {}
    try { await conn.execute(`ALTER TABLE delivery_items ADD COLUMN wattage VARCHAR(50)`); } catch(e) {}
    try { await conn.execute(`ALTER TABLE delivery_items ADD COLUMN brightness VARCHAR(50)`); } catch(e) {}
    try { await conn.execute(`ALTER TABLE delivery_items ADD COLUMN sensor_mode VARCHAR(50)`); } catch(e) {}
    try { await conn.execute(`ALTER TABLE delivery_items ADD COLUMN unit VARCHAR(20)`); } catch(e) {}

    // 客户表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS customers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        contact VARCHAR(50),
        phone VARCHAR(20),
        address VARCHAR(255),
        remark TEXT,
        user_id VARCHAR(64) NOT NULL,
        create_time DATETIME NOT NULL,
        update_time DATETIME NOT NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_name (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 兼容旧表：按需添加新增字段
    try { await conn.execute(`ALTER TABLE users ADD COLUMN ban_status VARCHAR(20) DEFAULT 'normal'`); } catch(e) {}
    try { await conn.execute(`ALTER TABLE users ADD COLUMN ban_reason TEXT`); } catch(e) {}
    try { await conn.execute(`ALTER TABLE users ADD COLUMN ban_start_time DATETIME`); } catch(e) {}
    try { await conn.execute(`ALTER TABLE users ADD COLUMN ban_end_time DATETIME`); } catch(e) {}
    try { await conn.execute(`ALTER TABLE users ADD COLUMN username VARCHAR(100)`); } catch(e) {}
    try { await conn.execute(`ALTER TABLE users ADD COLUMN member_expiry DATE`); } catch(e) {}
    try { await conn.execute(`ALTER TABLE users ADD COLUMN credit_score INT DEFAULT 0`); } catch(e) {}
    try { await conn.execute(`ALTER TABLE users ADD COLUMN account_balance DECIMAL(10,2) DEFAULT 0`); } catch(e) {}
    try { await conn.execute(`ALTER TABLE users ADD COLUMN exclusive_services INT DEFAULT 0`); } catch(e) {}

    console.log('MySQL表结构创建/更新成功');
  } finally {
    conn.release();
  }
}

// ============================================================
// 数据库初始化（SQLite本地数据库作为备份）
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

// 内存存储作为fallback
let memoryUsers = [];
let memoryAccounts = [];

function initMainDb() {
  if (Database) {
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
          username TEXT,
          phone TEXT NOT NULL,
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
          last_sync_time TEXT,
          member_points INTEGER DEFAULT 0,
          member_expiry TEXT,
          credit_score INTEGER DEFAULT 0,
          account_balance REAL DEFAULT 0,
          exclusive_services INTEGER DEFAULT 0
        );
      `);
      try { usersDb.exec(`ALTER TABLE users ADD COLUMN username TEXT`); } catch (e) {}
      try { usersDb.exec(`ALTER TABLE users ADD COLUMN industry TEXT`); } catch (e) {}
      try { usersDb.exec(`ALTER TABLE users ADD COLUMN member_points INTEGER DEFAULT 0`); } catch (e) {}
      try { usersDb.exec(`ALTER TABLE users ADD COLUMN member_expiry TEXT`); } catch (e) {}
      try { usersDb.exec(`ALTER TABLE users ADD COLUMN credit_score INTEGER DEFAULT 0`); } catch (e) {}
      try { usersDb.exec(`ALTER TABLE users ADD COLUMN account_balance REAL DEFAULT 0`); } catch (e) {}
      try { usersDb.exec(`ALTER TABLE users ADD COLUMN exclusive_services INTEGER DEFAULT 0`); } catch (e) {}
      try { usersDb.exec(`ALTER TABLE users ADD COLUMN ban_status TEXT DEFAULT 'normal'`); } catch (e) {}
      try { usersDb.exec(`ALTER TABLE users ADD COLUMN ban_reason TEXT`); } catch (e) {}
      try { usersDb.exec(`ALTER TABLE users ADD COLUMN ban_start_time TEXT`); } catch (e) {}
      try { usersDb.exec(`ALTER TABLE users ADD COLUMN ban_end_time TEXT`); } catch (e) {}

      // 创建唯一索引：个人用户手机号唯一，企业用户用户名唯一
      try { usersDb.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_personal_phone ON users(phone) WHERE user_type = 'personal'`); } catch (e) {}
      try { usersDb.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_username ON users(username)`); } catch (e) {}
      // 企业用户：同一企业名称+信用代码组合唯一
      try { usersDb.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_enterprise_unique ON users(credit_code) WHERE user_type = 'enterprise' AND credit_code IS NOT NULL AND credit_code != ''`); } catch (e) {}
      
      // 创建管理员通知表
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS admin_notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          create_time TEXT NOT NULL,
          status TEXT DEFAULT 'unread'
        );
      `);
      
      // 创建语音提醒表
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS voice_notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          content TEXT NOT NULL,
          create_time TEXT NOT NULL,
          status TEXT DEFAULT 'pending'
        );
      `);
      
      // 创建聊天通知表
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS chat_notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          priority TEXT DEFAULT 'medium',
          status TEXT DEFAULT 'unread'
        );
      `);
      
      // 创建商品表
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT,
          name TEXT NOT NULL,
          category TEXT,
          unit TEXT,
          price REAL DEFAULT 0,
          stock INTEGER DEFAULT 0,
          threshold INTEGER DEFAULT 10,
          user_id TEXT NOT NULL,
          create_time TEXT NOT NULL,
          update_time TEXT NOT NULL
        );
      `);
      try { usersDb.exec(`ALTER TABLE products ADD COLUMN user_id TEXT`); } catch (e) {}
      
      // 创建客户表
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS customers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          contact TEXT,
          phone TEXT,
          address TEXT,
          user_id TEXT NOT NULL,
          create_time TEXT NOT NULL,
          update_time TEXT NOT NULL
        );
      `);
      try { usersDb.exec(`ALTER TABLE customers ADD COLUMN user_id TEXT`); } catch (e) {}
      try { usersDb.exec(`ALTER TABLE customers ADD COLUMN remark TEXT`); } catch (e) {}
      
      // 创建送货单表
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS delivery_notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          no TEXT NOT NULL,
          customer TEXT NOT NULL,
          contact TEXT,
          contact_phone TEXT,
          date TEXT NOT NULL,
          status TEXT DEFAULT '待送达',
          address TEXT,
          remark TEXT,
          items TEXT,
          user_id TEXT NOT NULL,
          create_time TEXT NOT NULL,
          update_time TEXT NOT NULL
        );
      `);
      try { usersDb.exec(`ALTER TABLE delivery_notes ADD COLUMN user_id TEXT`); } catch (e) {}
      try { usersDb.exec(`ALTER TABLE delivery_notes ADD COLUMN items TEXT`); } catch (e) {}
      try { usersDb.exec(`ALTER TABLE delivery_notes ADD COLUMN contact_phone TEXT`); } catch (e) {}
      
      // 创建出入库记录表
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS inventory_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          record_no TEXT NOT NULL,
          product_name TEXT NOT NULL,
          product_code TEXT,
          type TEXT NOT NULL,
          quantity INTEGER NOT NULL,
          unit TEXT NOT NULL,
          date TEXT NOT NULL,
          operator TEXT NOT NULL,
          remark TEXT,
          user_id TEXT NOT NULL,
          create_time TEXT NOT NULL
        );
      `);

      // 创建蜻蜓chat群组表
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS dragonfly_groups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          group_id TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          icon TEXT DEFAULT '👥',
          creator_id TEXT NOT NULL,
          creator_name TEXT NOT NULL,
          max_members INTEGER DEFAULT 500,
          member_count INTEGER DEFAULT 1,
          status TEXT DEFAULT 'active',
          create_time TEXT NOT NULL,
          update_time TEXT NOT NULL
        );
      `);

      // 创建蜻蜓chat圈子表
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS dragonfly_circles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          circle_id TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          icon TEXT NOT NULL,
          category TEXT NOT NULL,
          creator_id TEXT NOT NULL,
          creator_name TEXT NOT NULL,
          max_users INTEGER DEFAULT 500,
          member_count INTEGER DEFAULT 1,
          tags TEXT,
          status TEXT DEFAULT 'active',
          create_time TEXT NOT NULL,
          update_time TEXT NOT NULL
        );
      `);

      // 创建蜻蜓chat群组成员表
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS dragonfly_group_members (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          group_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          user_name TEXT NOT NULL,
          join_time TEXT NOT NULL,
          UNIQUE(group_id, user_id)
        );
      `);

      // 创建蜻蜓chat圈子成员表
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS dragonfly_circle_members (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          circle_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          user_name TEXT NOT NULL,
          join_time TEXT NOT NULL,
          UNIQUE(circle_id, user_id)
        );
      `);

      // 创建蜻蜓chat消息表
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS dragonfly_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          message_id TEXT UNIQUE NOT NULL,
          type TEXT NOT NULL,
          target_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          user_name TEXT NOT NULL,
          content TEXT NOT NULL,
          create_time TEXT NOT NULL
        );
      `);

      // 设置控制台编码为UTF-8（Windows）
      if (process.stdout && process.stdout.isTTY) {
        process.stdout.setDefaultEncoding('utf8');
      }
      console.log('主账套数据库初始化完成: db/accounts.db');
      console.log('用户主数据库初始化完成: db/users.db');
    } catch (e) {
      console.error('主账套数据库初始化失败:', e.message);
      console.log('使用内存存储作为临时解决方案');
    }
  } else {
    console.log('better-sqlite3 未安装，使用内存存储作为临时解决方案');
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

// 导入备份管理器
let BackupManager = null;
try {
  BackupManager = require('./backup-manager.js');
} catch (e) {
  console.warn('备份管理器未安装，使用基础备份功能:', e.message);
}

// 云端备份：使用备份管理器备份账套数据库
function cloudBackupAccount(account) {
  try {
    // 首先备份元信息到JSON（用于恢复账套结构）
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const metadataFile = path.join(cloudBackupDir, account.id + '_metadata_' + timestamp + '.json');
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
    fs.writeFileSync(metadataFile, JSON.stringify(backupData, null, 2), 'utf8');
    console.log('账套元信息备份完成: ' + metadataFile);

    // 如果备份管理器可用，备份实际数据库文件
    if (BackupManager && account.db_file) {
      const backupMgr = new BackupManager({
        localBackupDir: cloudBackupDir,
        dbDir: dbDir
      });
      const dbFile = account.db_file;
      if (fs.existsSync(dbFile)) {
        const backupResult = backupMgr.backupLocal(account.id, dbFile);
        if (backupResult) {
          console.log('账套数据库备份完成: ' + backupResult.path);
        }
      }
    }

    // 清理旧备份（只保留最近10个）
    try {
      const backupFiles = fs.readdirSync(cloudBackupDir)
        .filter(function(f) { return f.startsWith(account.id + '_'); })
        .sort();
      if (backupFiles.length > 10) {
        backupFiles.slice(0, backupFiles.length - 10).forEach(function(f) {
          try { fs.unlinkSync(path.join(cloudBackupDir, f)); } catch (err) {}
        });
      }
    } catch (e) {}

    return metadataFile;
  } catch (e) {
    console.error('云端备份失败:', e.message);
    return null;
  }
}

// 初始化主数据库
initMainDb();

// 初始化MySQL数据库（异步）
initMySQL().then(mysqlReady => {
  if (mysqlReady) {
    console.log('✅ MySQL数据库已启用，应用与数据库服务器分离');
  } else {
    console.log('⚠️ MySQL未启用，使用本地SQLite数据库');
  }
}).catch(err => {
  console.error('MySQL初始化失败:', err.message);
});

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
  { name: '湖南闰贤环保科技有限公司', creditCode: '91430100MA4R7G5X2J', legalPerson: '张伟', address: '湖南省长沙市岳麓区' },
  { name: '湖南考拉环保科技有限公司', creditCode: '91430100MA4R7G5X3K', legalPerson: '陈晨', address: '湖南省长沙市岳麓区' },
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

// 从外部API搜索企业信息（企查查、天眼查等）
// 支持多个数据源，按优先级依次尝试
function searchEnterpriseFromExternalAPI(keyword, callback) {
  const qccApiKey = process.env.QCC_API_KEY || '';
  const tianyanchaApiKey = process.env.TIANYANCHA_API_KEY || '';

  // 优先使用企查查API（数据更全面）
  if (qccApiKey) {
    searchFromQcc(keyword, qccApiKey, function(err, results) {
      if (!err && results && results.length > 0) {
        callback(null, results);
        return;
      }
      // 企查查失败，尝试天眼查
      if (tianyanchaApiKey) {
        searchFromTianyancha(keyword, tianyanchaApiKey, callback);
      } else {
        // 尝试免费公开接口
        searchEnterpriseFromPublicAPI(keyword, callback);
      }
    });
    return;
  }

  // 使用天眼查API
  if (tianyanchaApiKey) {
    searchFromTianyancha(keyword, tianyanchaApiKey, function(err, results) {
      if (!err && results && results.length > 0) {
        callback(null, results);
        return;
      }
      // 天眼查失败，尝试免费公开接口
      searchEnterpriseFromPublicAPI(keyword, callback);
    });
    return;
  }

  // 没有配置API Key，尝试使用免费的公开接口
  searchEnterpriseFromPublicAPI(keyword, callback);
}

// 企查查API搜索
function searchFromQcc(keyword, apiKey, callback) {
  const secretKey = process.env.QCC_SECRET_KEY || '';

  // 企查查API签名认证
  // 生成时间戳（企查查要求秒级10位时间戳）
  const timespan = Math.floor(Date.now() / 1000).toString();

  // 生成签名: MD5(Key + Timespan + SecretKey)
  const signStr = apiKey + timespan + secretKey;
  const signature = crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();

  const options = {
    hostname: 'api.qichacha.com',
    path: '/ECISimple/GetSimpleSearch?keyword=' + encodeURIComponent(keyword),
    method: 'GET',
    headers: {
      'AuthId': apiKey,
      'AuthKey': signature,
      'Timespan': timespan,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Content-Type': 'application/json'
    }
  };

  const req = https.request(options, function(res) {
    let data = '';
    res.on('data', function(chunk) { data += chunk; });
    res.on('end', function() {
      try {
        const result = JSON.parse(data);
        if (result.Status === '200' && result.Result) {
          const enterprises = result.Result.slice(0, 10).map(function(item) {
            return {
              name: item.Name || item.name || '',
              creditCode: item.CreditCode || item.creditCode || '',
              legalPerson: item.OperName || item.legalPerson || '',
              address: item.Address || item.address || '',
              status: item.Status || item.status || '',
              regCapital: item.RegistCapi || item.regCapital || '',
              estiblishTime: item.SetupDate || item.estiblishTime || '',
              source: 'qcc'
            };
          });
          callback(null, enterprises);
        } else {
          callback(new Error('企查查API返回错误: ' + (result.Message || '未知错误')), null);
        }
      } catch (e) {
        callback(e, null);
      }
    });
  });

  req.on('error', function(e) {
    callback(e, null);
  });

  req.setTimeout(8000, function() {
    req.destroy();
    callback(new Error('企查查请求超时'), null);
  });

  req.end();
}

// 天眼查API搜索
function searchFromTianyancha(keyword, apiKey, callback) {
  const options = {
    hostname: 'open.api.tianyancha.com',
    path: '/services/v4/open/search?keyword=' + encodeURIComponent(keyword),
    method: 'GET',
    headers: {
      'Authorization': apiKey
    }
  };

  const req = https.request(options, function(res) {
    let data = '';
    res.on('data', function(chunk) { data += chunk; });
    res.on('end', function() {
      try {
        const result = JSON.parse(data);
        if (result.error_code === 0 && result.result && result.result.items) {
          const enterprises = result.result.items.slice(0, 10).map(function(item) {
            return {
              name: item.name || '',
              creditCode: item.creditCode || '',
              legalPerson: item.legalPersonName || '',
              address: item.regLocation || '',
              status: item.regStatus || '',
              regCapital: item.regCapital || '',
              estiblishTime: item.estiblishTime || '',
              source: 'tianyancha'
            };
          });
          callback(null, enterprises);
        } else {
          callback(new Error('天眼查API返回错误'), null);
        }
      } catch (e) {
        callback(e, null);
      }
    });
  });

  req.on('error', function(e) {
    callback(e, null);
  });

  req.setTimeout(8000, function() {
    req.destroy();
    callback(new Error('天眼查请求超时'), null);
  });

  req.end();
}

// 使用免费公开API搜索企业信息
function searchEnterpriseFromPublicAPI(keyword, callback) {
  // 方案1: 使用国家企业信用信息公示系统（需要处理验证码，暂不可用）
  // 方案2: 使用第三方免费接口

  // 尝试使用阿里云市场免费接口（需要配置）
  const aliyunAppCode = process.env.ALIYUN_ENTERPRISE_APP_CODE || '';

  if (aliyunAppCode) {
    searchFromAliyun(keyword, aliyunAppCode, callback);
    return;
  }

  // 尝试使用聚合数据免费接口
  const juheApiKey = process.env.JUHE_ENTERPRISE_KEY || '';
  if (juheApiKey) {
    searchFromJuhe(keyword, juheApiKey, callback);
    return;
  }

  // 没有可用的免费API，返回null使用本地数据
  callback(null, null);
}

// 阿里云市场企业查询接口
function searchFromAliyun(keyword, appCode, callback) {
  const options = {
    hostname: 'aliyun-company-search.p.rapidapi.com',
    path: '/api/company/search?keyword=' + encodeURIComponent(keyword),
    method: 'GET',
    headers: {
      'Authorization': 'APPCODE ' + appCode,
      'User-Agent': 'Mozilla/5.0'
    }
  };

  const req = https.request(options, function(res) {
    let data = '';
    res.on('data', function(chunk) { data += chunk; });
    res.on('end', function() {
      try {
        const result = JSON.parse(data);
        if (result.code === 200 && result.data) {
          const enterprises = result.data.slice(0, 10).map(function(item) {
            return {
              name: item.name || item.companyName || '',
              creditCode: item.creditCode || item.creditNo || '',
              legalPerson: item.legalPerson || item.operName || '',
              address: item.address || '',
              status: item.status || '',
              regCapital: item.regCapital || '',
              source: 'aliyun'
            };
          });
          callback(null, enterprises);
        } else {
          callback(null, null);
        }
      } catch (e) {
        callback(null, null);
      }
    });
  });

  req.on('error', function(e) {
    callback(null, null);
  });

  req.setTimeout(5000, function() {
    req.destroy();
    callback(null, null);
  });

  req.end();
}

// 聚合数据企业查询接口
function searchFromJuhe(keyword, apiKey, callback) {
  const options = {
    hostname: 'apis.juhe.cn',
    path: '/simpleCensusUnit/query?keyword=' + encodeURIComponent(keyword) + '&key=' + apiKey,
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  };

  const req = https.request(options, function(res) {
    let data = '';
    res.on('data', function(chunk) { data += chunk; });
    res.on('end', function() {
      try {
        const result = JSON.parse(data);
        if (result.error_code === 0 && result.result) {
          const enterprises = result.result.slice(0, 10).map(function(item) {
            return {
              name: item.name || item.companyName || '',
              creditCode: item.creditCode || item.creditNo || '',
              legalPerson: item.legalPerson || '',
              address: item.address || '',
              status: item.status || '',
              source: 'juhe'
            };
          });
          callback(null, enterprises);
        } else {
          callback(null, null);
        }
      } catch (e) {
        callback(null, null);
      }
    });
  });

  req.on('error', function(e) {
    callback(null, null);
  });

  req.setTimeout(5000, function() {
    req.destroy();
    callback(null, null);
  });

  req.end();
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

// ============================================================
// 阿里云OCR API调用
// ============================================================
async function callAliyunOcr(imageBase64, type) {
  const accessKeyId = process.env.ALIYUN_OCR_ACCESS_KEY_ID || process.env.ALIYUN_ACCESS_KEY_ID || '';
  const accessKeySecret = process.env.ALIYUN_OCR_ACCESS_KEY_SECRET || process.env.ALIYUN_ACCESS_KEY_SECRET || '';

  if (!accessKeyId || !accessKeySecret) {
    return {
      success: false,
      message: 'OCR服务未配置，请联系管理员配置阿里云OCR密钥（ALIYUN_OCR_ACCESS_KEY_ID 和 ALIYUN_OCR_ACCESS_KEY_SECRET）'
    };
  }

  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const nonce = Math.random().toString(36).substring(2);

    const params = {
      Format: 'JSON',
      Version: '2021-07-07',
      AccessKeyId: accessKeyId,
      SignatureMethod: 'HMAC-SHA1',
      Timestamp: timestamp,
      SignatureVersion: '1.0',
      SignatureNonce: nonce,
      Action: type === 'table' ? 'RecognizeTable' : 'RecognizeGeneral',
      ImageURL: '', // 使用Base64
      ImageBase64: imageBase64
    };

    // 构造签名字符串
    const sortedKeys = Object.keys(params).sort();
    const canonicalizedQueryString = sortedKeys.map(key => {
      return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
    }).join('&');

    const stringToSign = 'GET&%2F&' + encodeURIComponent(canonicalizedQueryString);

    // 计算签名
    const hmac = crypto.createHmac('sha1', accessKeySecret + '&');
    hmac.update(stringToSign);
    const signature = hmac.digest('base64');

    const requestOptions = {
      hostname: 'ocr-api.cn-hangzhou.aliyuncs.com',
      port: 443,
      path: '/?' + canonicalizedQueryString + '&Signature=' + encodeURIComponent(signature),
      method: 'GET'
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.Code || result.code) {
            resolve({
              success: false,
              message: result.Message || result.message || 'OCR识别失败'
            });
          } else {
            // 解析OCR结果
            if (type === 'table') {
              const tables = result.Data?.Tables || [];
              const tableData = tables.map(t => t.TableBody || []);
              resolve({
                success: true,
                type: 'table',
                tables: tableData,
                text: JSON.stringify(tableData)
              });
            } else {
              const blocks = result.Data?.BlockList || [];
              const text = blocks.map(b => b.Content || b.Text || '').join('\n');
              resolve({
                success: true,
                type: 'text',
                text: text
              });
            }
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// 加载订单数据
loadOrders();

// 加载征信打印点数据
loadCreditPrintPoints();

// 启动定时更新任务
scheduleCreditPrintPointsUpdate();

// 创建服务器
const server = http.createServer(async (req, res) => {
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

      // 尝试从外部API获取企业信息
      searchEnterpriseFromExternalAPI(keyword, function(err, externalResults) {
        if (!err && externalResults && externalResults.length > 0) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, data: externalResults, source: 'external' }));
          return;
        }

        // 外部API失败时，使用本地数据库作为备用
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
            note: '未找到精确匹配，已返回智能联想结果',
            source: 'fallback'
          }));
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, data: results, source: 'local' }));
      });

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
    req.on('end', async function() {
      try {
        if (!mysqlPool && !usersDb) throw new Error('用户数据库未初始化');
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

        if (mysqlPool) {
          const [rows] = await mysqlPool.execute('SELECT id FROM users WHERE phone = ?', [data.phone]);
          if (!rows.length) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: '该手机号未注册' }));
            return;
          }
          await mysqlPool.execute('UPDATE users SET password = ?, update_time = ? WHERE phone = ?', [data.password, new Date(), data.phone]);
        } else {
          const exists = usersDb.prepare('SELECT id FROM users WHERE phone = ?').get(data.phone);
          if (!exists) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: '该手机号未注册' }));
            return;
          }
          usersDb.prepare('UPDATE users SET password = ?, update_time = ? WHERE phone = ?')
            .run(data.password, new Date().toISOString(), data.phone);
        }

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
      let users = [];
      
      if (mysqlPool) {
        const [rows] = await mysqlPool.query('SELECT id, username, phone, user_type, institution_type, institution_name, credit_code, contact_person, industry, sync_status, last_sync_time, member_points, member_expiry, credit_score, account_balance, exclusive_services, ban_status, ban_reason, ban_start_time, ban_end_time, create_time, update_time FROM users ORDER BY create_time DESC');
        users = rows;
      } else if (usersDb) {
        users = usersDb.prepare('SELECT * FROM users ORDER BY create_time DESC').all();
      }
      
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

  } else if (pathname === '/api/admin/users/update' && req.method === 'POST') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.id) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '用户ID不能为空' }));
          return;
        }

        if (!usersDb) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库服务未启动' }));
          return;
        }

        const updateFields = [];
        const updateValues = [];
        
        if (data.member_points !== undefined) {
          updateFields.push('member_points = ?');
          updateValues.push(parseInt(data.member_points) || 0);
        }
        if (data.member_expiry !== undefined) {
          updateFields.push('member_expiry = ?');
          updateValues.push(data.member_expiry || null);
        }
        if (data.credit_score !== undefined) {
          updateFields.push('credit_score = ?');
          updateValues.push(parseInt(data.credit_score) || 0);
        }
        if (data.account_balance !== undefined) {
          updateFields.push('account_balance = ?');
          updateValues.push(parseFloat(data.account_balance) || 0);
        }
        if (data.exclusive_services !== undefined) {
          updateFields.push('exclusive_services = ?');
          updateValues.push(parseInt(data.exclusive_services) || 0);
        }
        
        updateFields.push('update_time = ?');
        updateValues.push(new Date().toISOString());
        updateValues.push(data.id);

        const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
        usersDb.prepare(query).run(...updateValues);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '用户信息更新成功' }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '更新用户信息失败: ' + e.message }));
      }
    });

  } else if (pathname === '/api/admin/users/delete' && req.method === 'POST') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', async function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.id) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '用户ID不能为空' }));
          return;
        }

        if (!mysqlPool) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库服务未连接' }));
          return;
        }

        await mysqlPool.execute('DELETE FROM users WHERE id = ?', [data.id]);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '用户删除成功' }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '删除用户失败: ' + e.message }));
      }
    });

  } else if (pathname === '/api/admin/users/ban' && req.method === 'POST') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', async function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.id) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '用户ID不能为空' }));
          return;
        }
        if (!data.reason) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '封锁原因不能为空' }));
          return;
        }
        if (!data.duration) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '封锁时长不能为空' }));
          return;
        }

        const durationDays = parseInt(data.duration);
        const now = new Date();
        const startTime = now.toISOString();
        const endTime = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

        if (mysqlPool) {
          await mysqlPool.execute(
            'UPDATE users SET ban_status = ?, ban_reason = ?, ban_start_time = ?, ban_end_time = ?, update_time = ? WHERE id = ?',
            ['banned', data.reason, startTime, endTime, new Date().toISOString(), data.id]
          );
        } else if (usersDb) {
          usersDb.prepare('UPDATE users SET ban_status = ?, ban_reason = ?, ban_start_time = ?, ban_end_time = ?, update_time = ? WHERE id = ?')
            .run('banned', data.reason, startTime, endTime, new Date().toISOString(), data.id);
        } else {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库服务未连接' }));
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '用户已被封锁' }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '封锁用户失败: ' + e.message }));
      }
    });

  } else if (pathname === '/api/admin/users/unban' && req.method === 'POST') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', async function() {
      try {
        const data = JSON.parse(body || '{}');
if (!data.id) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '用户ID不能为空' }));
          return;
        }

        if (mysqlPool) {
          await mysqlPool.execute(
            'UPDATE users SET ban_status = ?, ban_reason = NULL, ban_start_time = NULL, ban_end_time = NULL, update_time = ? WHERE id = ?',
            ['normal', new Date().toISOString(), data.id]
          );
        } else if (usersDb) {
          usersDb.prepare('UPDATE users SET ban_status = ?, ban_reason = NULL, ban_start_time = NULL, ban_end_time = NULL, update_time = ? WHERE id = ?')
            .run('normal', new Date().toISOString(), data.id);
        } else {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库服务未连接' }));
          return;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '用户已解除封锁' }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '解除封锁失败: ' + e.message }));
      }
    });

  } else if (pathname === '/api/products' && req.method === 'GET') {
    // 获取商品列表
    try {
      if (!usersDb) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '数据库服务未启动' }));
        return;
      }

      // 从URL参数中获取userId
      const urlParams = new URL(req.url, 'http://localhost');
      const userId = urlParams.searchParams.get('userId');

      if (!userId) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '用户ID不能为空' }));
        return;
      }

      const products = usersDb.prepare('SELECT * FROM products WHERE user_id = ? ORDER BY id ASC').all(userId);

      // 不再自动插入预置商品，已登录用户只显示自己添加的商品
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: products }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '获取商品列表失败: ' + e.message }));
    }

  } else if (pathname === '/api/products' && req.method === 'POST') {
    // 添加商品
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', function() {
      try {
        const data = JSON.parse(body || '{}');
        
        if (!data.name || !data.userId) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '商品名称和用户ID不能为空' }));
          return;
        }

        if (!usersDb) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库服务未启动' }));
          return;
        }

        const now = new Date().toISOString();
        const result = usersDb.prepare(`
          INSERT INTO products (code, name, category, unit, price, stock, threshold, user_id, create_time, update_time)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          data.code || '',
          data.name,
          data.category || '',
          data.unit || '',
          parseFloat(data.price) || 0,
          parseInt(data.stock) || 0,
          parseInt(data.threshold) || 10,
          data.userId,
          now,
          now
        );

        const newProduct = usersDb.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '商品添加成功', data: newProduct }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '添加商品失败: ' + e.message }));
      }
    });

  } else if (pathname === '/api/products' && req.method === 'PUT') {
    // 更新商品
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', function() {
      try {
        const data = JSON.parse(body || '{}');
        
        if (!data.id) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '商品ID不能为空' }));
          return;
        }

        if (!usersDb) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库服务未启动' }));
          return;
        }

        const updateFields = [];
        const updateValues = [];
        
        if (data.code !== undefined) {
          updateFields.push('code = ?');
          updateValues.push(data.code || '');
        }
        if (data.name !== undefined) {
          updateFields.push('name = ?');
          updateValues.push(data.name);
        }
        if (data.category !== undefined) {
          updateFields.push('category = ?');
          updateValues.push(data.category || '');
        }
        if (data.unit !== undefined) {
          updateFields.push('unit = ?');
          updateValues.push(data.unit || '');
        }
        if (data.price !== undefined) {
          updateFields.push('price = ?');
          updateValues.push(parseFloat(data.price) || 0);
        }
        if (data.stock !== undefined) {
          updateFields.push('stock = ?');
          updateValues.push(parseInt(data.stock) || 0);
        }
        if (data.threshold !== undefined) {
          updateFields.push('threshold = ?');
          updateValues.push(parseInt(data.threshold) || 10);
        }
        
        updateFields.push('update_time = ?');
        updateValues.push(new Date().toISOString());
        updateValues.push(data.id);

        const query = `UPDATE products SET ${updateFields.join(', ')} WHERE id = ?`;
        usersDb.prepare(query).run(...updateValues);

        const updatedProduct = usersDb.prepare('SELECT * FROM products WHERE id = ?').get(data.id);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '商品更新成功', data: updatedProduct }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '更新商品失败: ' + e.message }));
      }
    });

  } else if (pathname === '/api/products' && req.method === 'DELETE') {
    // 删除商品（支持单个id或ids数组）
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', function() {
      try {
        const data = JSON.parse(body || '{}');

        // 支持单个id或ids数组
        let idsToDelete = [];
        if (data.id) {
          idsToDelete = [data.id];
        } else if (data.ids && Array.isArray(data.ids)) {
          idsToDelete = data.ids;
        } else {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '商品ID为必填项' }));
          return;
        }

        if (!usersDb) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库服务未启动' }));
          return;
        }

        const deleteStmt = usersDb.prepare('DELETE FROM products WHERE id = ?');
        let deletedCount = 0;
        idsToDelete.forEach(function(id) {
          const result = deleteStmt.run(id);
          if (result.changes > 0) {
            deletedCount++;
          }
        });

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '已删除 ' + deletedCount + ' 个商品', deletedCount: deletedCount }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '删除商品失败: ' + e.message }));
      }
    });

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
    req.on('end', async function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.phone || !data.password || !data.userType) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '手机号、密码、用户类型为必填项' }));
          return;
        }

        // 用户名默认为手机号
        const username = data.username || data.phone;

        // 检查数据库连接
        if (!mysqlPool) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库服务未连接' }));
          return;
        }

        // 个人注册：检查手机号是否已存在
        if (data.userType === 'personal') {
          const [rows] = await mysqlPool.execute('SELECT id FROM users WHERE phone = ? AND user_type = ?', [data.phone, 'personal']);
          if (rows.length > 0) {
            res.statusCode = 409;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: '该手机号已注册个人账户，请直接登录或使用其他手机号' }));
            return;
          }
        }

        // 企业注册：检查企业是否已存在（通过统一社会信用代码）
        if (data.userType === 'enterprise' && data.creditCode) {
          const [rows] = await mysqlPool.execute('SELECT id FROM users WHERE credit_code = ? AND user_type = ?', [data.creditCode, 'enterprise']);
          if (rows.length > 0) {
            res.statusCode = 409;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: '该企业已注册，请直接登录或联系管理员' }));
            return;
          }
        }

        // 检查用户名是否已存在
        const [existsRows] = await mysqlPool.execute('SELECT id FROM users WHERE username = ?', [username]);
        if (existsRows.length > 0) {
          res.statusCode = 409;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '该用户名已被使用，请更换用户名' }));
          return;
        }

        const userId = 'USER_' + Date.now();
        const now = new Date();
        
        await mysqlPool.execute(
          'INSERT INTO users (id, username, phone, password, user_type, institution_type, institution_name, credit_code, contact_person, industry, sync_status, last_sync_time, member_points, credit_score, account_balance, exclusive_services, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [userId, username, data.phone, data.password, data.userType, data.institutionType || '', data.institutionName || '', data.creditCode || '', data.contactPerson || '', data.industry || '', 'synced', now, 0, 0, 0, 0, now, now]
        );

        const user = { id: userId, phone: data.phone, user_type: data.userType, username: username };

        // 发送管理员提醒到MySQL
        const adminMessage = `📢 新用户注册通知\n\n用户ID: ${user.id}\n手机号: ${user.phone}\n用户类型: ${data.userType === 'enterprise' ? '企业用户' : data.userType === 'institution' ? '机构用户' : '个人用户'}\n用户名: ${username}\n注册时间: ${new Date().toLocaleString('zh-CN')}`;
        
        // 消息提醒 - 存储到MySQL
        await mysqlPool.execute(
          'INSERT INTO admin_notifications (type, title, content, create_time, status) VALUES (?, ?, ?, ?, ?)',
          ['user_register', '新用户注册', adminMessage, new Date(), 'unread']
        );
        
        console.log('管理员提醒已发送:', adminMessage);
        
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: true,
          data: {
            id: user.id,
            phone: user.phone,
            userType: data.userType
          },
          message: '注册成功'
        }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '注册失败: ' + e.message }));
      }
    });

  } else if (pathname === '/api/users/related-accounts' && req.method === 'GET') {
    const phone = String(parsedUrl.query.phone || '').trim();
    if (!phone) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '手机号不能为空' }));
      return;
    }

    try {
      let accounts = [];
      if (usersDb) {
        accounts = usersDb.prepare('SELECT id, username, phone, user_type, institution_name, credit_code, create_time FROM users WHERE phone = ?').all(phone);
      } else {
        accounts = memoryUsers.filter(u => u.phone === phone).map(u => ({
          id: u.id,
          username: u.username,
          phone: u.phone,
          user_type: u.user_type,
          institution_name: u.institution_name,
          credit_code: u.credit_code,
          create_time: u.create_time
        }));
      }

      if (usersDb) {
        accounts = accounts.map(acc => {
          if (acc.user_type === 'enterprise') {
            const fullUser = usersDb.prepare('SELECT * FROM users WHERE id = ?').get(acc.id);
            return {
              ...acc,
              enterprise_name: fullUser ? (fullUser.enterprise_name || fullUser.institution_name || '') : ''
            };
          }
          return acc;
        });
      } else {
        accounts = accounts.map(acc => {
          const fullUser = memoryUsers.find(u => u.id === acc.id);
          if (fullUser && acc.user_type === 'enterprise') {
            return {
              ...acc,
              enterprise_name: fullUser.enterprise_name || ''
            };
          }
          return acc;
        });
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: accounts }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '查询失败: ' + e.message }));
    }

  } else if (pathname === '/api/users/login' && req.method === 'POST') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', async function() {
      try {
        const data = JSON.parse(body || '{}');
        const account = (data.account || '').trim();
        const password = data.password || '';
        const userType = data.userType || 'personal';

        if (!account || !password) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '账号和密码不能为空' }));
          return;
        }

        let user = null;

        // 优先从MySQL查询
        if (mysqlPool) {
          let query = '';
          let params = [];

          if (userType === 'enterprise') {
            // 企业用户按用户名查询
            query = 'SELECT * FROM users WHERE username = ? AND user_type = ?';
            params = [account, 'enterprise'];
          } else {
            // 个人/机构用户按手机号查询
            query = 'SELECT * FROM users WHERE phone = ? AND user_type = ?';
            params = [account, userType];
          }

          const [rows] = await mysqlPool.execute(query, params);
          if (rows.length > 0) {
            user = rows[0];
          }
        }

        // MySQL没有则从SQLite查询
        if (!user && usersDb) {
          if (userType === 'enterprise') {
            user = usersDb.prepare('SELECT * FROM users WHERE username = ? AND user_type = ?').get(account, 'enterprise');
          } else {
            user = usersDb.prepare('SELECT * FROM users WHERE phone = ? AND user_type = ?').get(account, userType);
          }
        }

        // 用户不存在
        if (!user) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '用户不存在，请先注册' }));
          return;
        }

        // 密码验证
        if (user.password !== password) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '密码错误' }));
          return;
        }

        // 登录成功，返回用户信息（不包含密码）
        const userData = { ...user };
        delete userData.password;

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: true,
          data: userData
        }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '登录失败: ' + e.message }));
      }
    });

  // 创建账套：POST /api/accounts
  } else if (pathname === '/api/accounts' && req.method === 'POST') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', async function() {
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

  // 获取账套备份列表：GET /api/accounts/:id/backups
  } else if (pathname.match(/^\/api\/accounts\/[^/]+\/backups$/) && req.method === 'GET') {
    const accountId = pathname.split('/')[3];
    try {
      const cloudBackupDir = path.join(dbDir, 'cloud_backup');
      const backups = [];
      if (fs.existsSync(cloudBackupDir)) {
        const files = fs.readdirSync(cloudBackupDir)
          .filter(f => f.includes(accountId))
          .sort()
          .reverse()
          .slice(0, 20);
        files.forEach(file => {
          const fullPath = path.join(cloudBackupDir, file);
          const stat = fs.statSync(fullPath);
          backups.push({
            file: file,
            size: stat.size,
            modified: stat.mtime.toISOString()
          });
        });
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: backups }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '获取备份列表失败: ' + e.message }));
    }

  // 恢复账套备份：POST /api/accounts/:id/restore
  } else if (pathname.match(/^\/api\/accounts\/[^/]+\/restore$/) && req.method === 'POST') {
    const accountId = pathname.split('/')[3];
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.backupFile) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '缺少备份文件名' }));
          return;
        }
        const cloudBackupDir = path.join(dbDir, 'cloud_backup');
        const backupFile = path.join(cloudBackupDir, data.backupFile);
        const accountDbFile = path.join(dbDir, 'account_' + accountId + '.db');

        if (!fs.existsSync(backupFile)) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '备份文件不存在' }));
          return;
        }

        // 备份当前数据库
        if (fs.existsSync(accountDbFile)) {
          const safetyBackup = accountDbFile + '.backup_' + Date.now();
          fs.copyFileSync(accountDbFile, safetyBackup);
          console.log('安全备份已创建: ' + safetyBackup);
        }

        // 恢复备份
        fs.copyFileSync(backupFile, accountDbFile);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '备份已恢复' }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '恢复备份失败: ' + e.message }));
      }
    });

  // ==================== 商品管理API ====================
  // 获取商品列表：GET /api/products
  } else if (pathname === '/api/products' && req.method === 'GET') {
    const userId = parsedUrl.query.userId;
    if (!usersDb) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: [] }));
      return;
    }
    try {
      const products = usersDb.prepare('SELECT * FROM products WHERE user_id = ? ORDER BY create_time DESC').all(userId || '');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: products }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '获取商品列表失败: ' + e.message }));
    }
  // 添加商品：POST /api/products
  } else if (pathname === '/api/products' && req.method === 'POST') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.name || !data.userId) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '商品名称和用户ID为必填项' }));
          return;
        }
        if (!usersDb) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库服务未启动' }));
          return;
        }
        const now = new Date().toISOString();
        const stmt = usersDb.prepare(
          'INSERT INTO products (code, name, category, unit, price, stock, threshold, user_id, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        const result = stmt.run(
          data.code || '',
          data.name,
          data.category || '',
          data.unit || '',
          parseFloat(data.price) || 0,
          parseInt(data.stock) || 0,
          parseInt(data.threshold) || 10,
          data.userId,
          now,
          now
        );
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, data: { id: result.lastInsertRowid } }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '添加商品失败: ' + e.message }));
      }
    });
  // 更新商品：PUT /api/products
  } else if (pathname === '/api/products' && req.method === 'PUT') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.id) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '商品ID为必填项' }));
          return;
        }
        if (!usersDb) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库服务未启动' }));
          return;
        }
        const updateFields = [];
        const updateValues = [];
        if (data.code !== undefined) { updateFields.push('code = ?'); updateValues.push(data.code); }
        if (data.name !== undefined) { updateFields.push('name = ?'); updateValues.push(data.name); }
        if (data.category !== undefined) { updateFields.push('category = ?'); updateValues.push(data.category); }
        if (data.unit !== undefined) { updateFields.push('unit = ?'); updateValues.push(data.unit); }
        if (data.price !== undefined) { updateFields.push('price = ?'); updateValues.push(parseFloat(data.price) || 0); }
        if (data.stock !== undefined) { updateFields.push('stock = ?'); updateValues.push(parseInt(data.stock) || 0); }
        if (data.threshold !== undefined) { updateFields.push('threshold = ?'); updateValues.push(parseInt(data.threshold) || 10); }
        updateFields.push('update_time = ?');
        updateValues.push(new Date().toISOString());
        updateValues.push(data.id);
        const stmt = usersDb.prepare(`UPDATE products SET ${updateFields.join(', ')} WHERE id = ?`);
        stmt.run(...updateValues);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '商品更新成功' }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '更新商品失败: ' + e.message }));
      }
    });

  // ==================== 客户管理API ====================
  // 获取客户列表：GET /api/customers
  } else if (pathname === '/api/customers' && req.method === 'GET') {
    const userId = parsedUrl.query.userId;

    // 优先从MySQL获取
    if (mysqlPool) {
      try {
        const [customers] = await mysqlPool.execute(
          'SELECT id, name, contact, phone, address, remark, user_id, create_time, update_time FROM customers WHERE user_id = ? ORDER BY create_time DESC',
          [userId || '']
        );
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, data: customers }));
        return;
      } catch (e) {
        console.error('MySQL获取客户列表失败:', e.message);
      }
    }

    // 回退到SQLite
    if (!usersDb) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: [] }));
      return;
    }
    try {
      const customers = usersDb.prepare('SELECT * FROM customers WHERE user_id = ? ORDER BY create_time DESC').all(userId || '');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: customers }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '获取客户列表失败: ' + e.message }));
    }
  // 添加客户：POST /api/customers
  } else if (pathname === '/api/customers' && req.method === 'POST') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', async function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.name || !data.userId) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '客户名称和用户ID为必填项' }));
          return;
        }

        const now = new Date().toISOString();

        // 优先写入MySQL
        if (mysqlPool) {
          try {
            const [result] = await mysqlPool.execute(
              'INSERT INTO customers (name, contact, phone, address, remark, user_id, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
              [data.name, data.contact || '', data.phone || '', data.address || '', data.remark || '', data.userId, now, now]
            );
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true, data: { id: result.insertId } }));
            return;
          } catch (e) {
            console.error('MySQL添加客户失败:', e.message);
          }
        }

        // 回退到SQLite
        if (!usersDb) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库服务未启动' }));
          return;
        }
        const stmt = usersDb.prepare(
          'INSERT INTO customers (name, contact, phone, address, remark, user_id, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        const result = stmt.run(
          data.name,
          data.contact || '',
          data.phone || '',
          data.address || '',
          data.remark || '',
          data.userId,
          now,
          now
        );
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, data: { id: result.lastInsertRowid } }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '添加客户失败: ' + e.message }));
      }
    });
  // 更新客户：PUT /api/customers
  } else if (pathname === '/api/customers' && req.method === 'PUT') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', async function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.id) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '客户ID为必填项' }));
          return;
        }

        const now = new Date().toISOString();

        // 优先更新MySQL
        if (mysqlPool) {
          try {
            const updateFields = [];
            const updateValues = [];
            if (data.name !== undefined) { updateFields.push('name = ?'); updateValues.push(data.name); }
            if (data.contact !== undefined) { updateFields.push('contact = ?'); updateValues.push(data.contact); }
            if (data.phone !== undefined) { updateFields.push('phone = ?'); updateValues.push(data.phone); }
            if (data.address !== undefined) { updateFields.push('address = ?'); updateValues.push(data.address); }
            if (data.remark !== undefined) { updateFields.push('remark = ?'); updateValues.push(data.remark); }
            updateFields.push('update_time = ?');
            updateValues.push(now);
            updateValues.push(data.id);
            await mysqlPool.execute(`UPDATE customers SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true, message: '客户更新成功' }));
            return;
          } catch (e) {
            console.error('MySQL更新客户失败:', e.message);
          }
        }

        // 回退到SQLite
        if (!usersDb) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库服务未启动' }));
          return;
        }
        const updateFields = [];
        const updateValues = [];
        if (data.name !== undefined) { updateFields.push('name = ?'); updateValues.push(data.name); }
        if (data.contact !== undefined) { updateFields.push('contact = ?'); updateValues.push(data.contact); }
        if (data.phone !== undefined) { updateFields.push('phone = ?'); updateValues.push(data.phone); }
        if (data.address !== undefined) { updateFields.push('address = ?'); updateValues.push(data.address); }
        if (data.remark !== undefined) { updateFields.push('remark = ?'); updateValues.push(data.remark); }
        updateFields.push('update_time = ?');
        updateValues.push(now);
        updateValues.push(data.id);
        const stmt = usersDb.prepare(`UPDATE customers SET ${updateFields.join(', ')} WHERE id = ?`);
        stmt.run(...updateValues);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '客户更新成功' }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '更新客户失败: ' + e.message }));
      }
    });
  // 删除客户：DELETE /api/customers
  } else if (pathname === '/api/customers' && req.method === 'DELETE') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', async function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.id) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '客户ID为必填项' }));
          return;
        }

        // 优先从MySQL删除
        if (mysqlPool) {
          try {
            await mysqlPool.execute('DELETE FROM customers WHERE id = ?', [data.id]);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true, message: '客户删除成功' }));
            return;
          } catch (e) {
            console.error('MySQL删除客户失败:', e.message);
          }
        }

        // 回退到SQLite
        if (!usersDb) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库服务未启动' }));
          return;
        }
        usersDb.prepare('DELETE FROM customers WHERE id = ?').run(data.id);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '客户删除成功' }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '删除客户失败: ' + e.message }));
      }
    });

  // ==================== 送货单管理API ====================
  // 获取送货单列表：GET /api/delivery-notes
  } else if (pathname === '/api/delivery-notes' && req.method === 'GET') {
    const userId = parsedUrl.query.userId;

    // 优先从MySQL获取
    if (mysqlPool) {
      try {
        const [orders] = await mysqlPool.execute(
          'SELECT * FROM delivery_orders WHERE user_id = ? ORDER BY create_time DESC',
          [userId || '']
        );

        const data = [];
        for (const order of orders) {
          // 获取该送货单的商品明细
          const [items] = await mysqlPool.execute(
            'SELECT product_name, model, length, wattage, brightness, sensor_mode, quantity, unit, unit_price, amount FROM delivery_items WHERE delivery_id = ?',
            [order.id]
          );

          data.push({
            id: order.id,
            no: order.order_no,
            customer: order.customer_name,
            project: order.project_name || '',
            contact: order.contact_name || '',
            contact_phone: order.customer_phone || '',
            date: order.delivery_date.toISOString().split('T')[0],
            status: order.status === 'pending' ? '待送达' : '已送达',
            address: order.customer_address || '',
            remark: order.remark || '',
            items: items.map(item => ({
              product: item.product_name,
              name: item.product_name,
              model: item.model || '',
              length: item.length || '',
              wattage: item.wattage || '',
              brightness: item.brightness || '',
              sensorMode: item.sensor_mode || '',
              quantity: item.quantity,
              unit: item.unit || '',
              price: item.unit_price
            })),
            user_id: order.user_id,
            create_time: order.create_time,
            update_time: order.update_time
          });
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, data: data }));
        return;
      } catch (e) {
        console.error('MySQL获取送货单失败:', e.message);
      }
    }

    // 回退到SQLite
    if (!usersDb) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: [] }));
      return;
    }
    try {
      const notes = usersDb.prepare('SELECT * FROM delivery_notes WHERE user_id = ? ORDER BY create_time DESC').all(userId || '');
      const data = notes.map(note => ({
        ...note,
        items: note.items ? JSON.parse(note.items) : []
      }));
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: data }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '获取送货单列表失败: ' + e.message }));
    }  // 添加送货单：POST /api/delivery-notes
  } else if (pathname === '/api/delivery-notes' && req.method === 'POST') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', async function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.customer || !data.date || !data.userId) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '客户、日期和用户ID为必填项' }));
          return;
        }

        const now = new Date();
        const orderNo = data.no || ('SHD' + now.getFullYear() +
          String(now.getMonth() + 1).padStart(2, '0') +
          String(now.getDate()).padStart(2, '0') +
          String(Date.now()).slice(-3));

        // 优先写入MySQL
        if (mysqlPool) {
          try {
            const conn = await mysqlPool.getConnection();
            try {
              await conn.beginTransaction();

              // 插入送货单主表
              const [orderResult] = await conn.execute(
                `INSERT INTO delivery_orders (order_no, customer_name, project_name, customer_phone, customer_address, contact_name, remark, delivery_date, total_amount, status, user_id, create_time, update_time)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  orderNo,
                  data.customer,
                  data.project || '',
                  data.contactPhone || '',
                  data.address || '',
                  data.contact || '',
                  data.remark || '',
                  data.date,
                  0,
                  data.status === '已送达' ? 'delivered' : 'pending',
                  data.userId,
                  now,
                  now
                ]
              );

              const deliveryId = orderResult.insertId;

              // 插入商品明细
              if (data.items && data.items.length > 0) {
                let totalAmount = 0;
                for (const item of data.items) {
                  const qty = parseFloat(item.quantity) || 0;
                  const price = parseFloat(item.price) || 0;
                  const amount = qty * price;
                  totalAmount += amount;

                  await conn.execute(
                    `INSERT INTO delivery_items (delivery_id, product_name, model, length, wattage, brightness, sensor_mode, quantity, unit, unit_price, amount)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                      deliveryId,
                      item.product || item.name || '',
                      item.model || '',
                      item.length || '',
                      item.wattage || '',
                      item.brightness || '',
                      item.sensor || item.sensorMode || '',
                      qty,
                      item.unit || '',
                      price,
                      amount
                    ]
                  );
                }

                // 更新总金额
                await conn.execute(
                  'UPDATE delivery_orders SET total_amount = ? WHERE id = ?',
                  [totalAmount, deliveryId]
                );
              }

              await conn.commit();
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: true, data: { id: deliveryId, no: orderNo } }));
              return;
            } catch (e) {
              await conn.rollback();
              throw e;
            } finally {
              conn.release();
            }
          } catch (e) {
            console.error('MySQL添加送货单失败:', e.message);
          }
        }

        // 回退到SQLite
        if (!usersDb) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库服务未启动' }));
          return;
        }
        const stmt = usersDb.prepare(
          'INSERT INTO delivery_notes (no, customer, contact, contact_phone, date, status, address, remark, items, user_id, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        const result = stmt.run(
          orderNo,
          data.customer,
          data.contact || '',
          data.contactPhone || '',
          data.date,
          data.status || '待送达',
          data.address || '',
          data.remark || '',
          data.items ? JSON.stringify(data.items) : '[]',
          data.userId,
          now.toISOString(),
          now.toISOString()
        );
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, data: { id: result.lastInsertRowid, no: orderNo } }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '添加送货单失败: ' + e.message }));
      }
    });
  // 更新送货单：PUT /api/delivery-notes
  } else if (pathname === '/api/delivery-notes' && req.method === 'PUT') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', async function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.id) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '送货单ID为必填项' }));
          return;
        }

        const now = new Date();

        // 优先更新MySQL
        if (mysqlPool) {
          try {
            const conn = await mysqlPool.getConnection();
            try {
              await conn.beginTransaction();

              // 更新送货单主表
              const updateFields = [];
              const updateValues = [];
              if (data.customer !== undefined) { updateFields.push('customer_name = ?'); updateValues.push(data.customer); }
              if (data.contactPhone !== undefined) { updateFields.push('customer_phone = ?'); updateValues.push(data.contactPhone); }
              if (data.address !== undefined) { updateFields.push('customer_address = ?'); updateValues.push(data.address); }
              if (data.project !== undefined) { updateFields.push('project_name = ?'); updateValues.push(data.project); }
              if (data.contact !== undefined) { updateFields.push('contact_name = ?'); updateValues.push(data.contact); }
              if (data.remark !== undefined) { updateFields.push('remark = ?'); updateValues.push(data.remark); }
              if (data.date !== undefined) { updateFields.push('delivery_date = ?'); updateValues.push(data.date); }
              if (data.status !== undefined) { updateFields.push('status = ?'); updateValues.push(data.status === '已送达' ? 'delivered' : 'pending'); }
              updateFields.push('update_time = ?');
              updateValues.push(now);
              updateValues.push(data.id);

              if (updateFields.length > 1) {
                await conn.execute(`UPDATE delivery_orders SET ${updateFields.join(', ')} WHERE id = ?`, updateValues);
              }

              // 更新商品明细：先删除旧的，再插入新的
              if (data.items !== undefined) {
                await conn.execute('DELETE FROM delivery_items WHERE delivery_id = ?', [data.id]);

                let totalAmount = 0;
                for (const item of data.items) {
                  const qty = parseFloat(item.quantity) || 0;
                  const price = parseFloat(item.price) || 0;
                  const amount = qty * price;
                  totalAmount += amount;

                  await conn.execute(
                    `INSERT INTO delivery_items (delivery_id, product_name, model, length, wattage, brightness, sensor_mode, quantity, unit, unit_price, amount)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                      data.id,
                      item.product || item.name || '',
                      item.model || '',
                      item.length || '',
                      item.wattage || '',
                      item.brightness || '',
                      item.sensor || item.sensorMode || '',
                      qty,
                      item.unit || '',
                      price,
                      amount
                    ]
                  );
                }

                // 更新总金额
                await conn.execute('UPDATE delivery_orders SET total_amount = ? WHERE id = ?', [totalAmount, data.id]);
              }

              await conn.commit();
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: true, message: '送货单更新成功' }));
              return;
            } catch (e) {
              await conn.rollback();
              throw e;
            } finally {
              conn.release();
            }
          } catch (e) {
            console.error('MySQL更新送货单失败:', e.message);
          }
        }

        // 回退到SQLite
        if (!usersDb) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库服务未启动' }));
          return;
        }
        const updateFields = [];
        const updateValues = [];
        if (data.no !== undefined) { updateFields.push('no = ?'); updateValues.push(data.no); }
        if (data.customer !== undefined) { updateFields.push('customer = ?'); updateValues.push(data.customer); }
        if (data.contact !== undefined) { updateFields.push('contact = ?'); updateValues.push(data.contact); }
        if (data.contactPhone !== undefined) { updateFields.push('contact_phone = ?'); updateValues.push(data.contactPhone); }
        if (data.date !== undefined) { updateFields.push('date = ?'); updateValues.push(data.date); }
        if (data.status !== undefined) { updateFields.push('status = ?'); updateValues.push(data.status); }
        if (data.address !== undefined) { updateFields.push('address = ?'); updateValues.push(data.address); }
        if (data.remark !== undefined) { updateFields.push('remark = ?'); updateValues.push(data.remark); }
        if (data.items !== undefined) { updateFields.push('items = ?'); updateValues.push(JSON.stringify(data.items)); }
        updateFields.push('update_time = ?');
        updateValues.push(now.toISOString());
        updateValues.push(data.id);
        const stmt = usersDb.prepare(`UPDATE delivery_notes SET ${updateFields.join(', ')} WHERE id = ?`);
        stmt.run(...updateValues);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '送货单更新成功' }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '更新送货单失败: ' + e.message }));
      }
    });
  // 删除送货单：DELETE /api/delivery-notes
  } else if (pathname === '/api/delivery-notes' && req.method === 'DELETE') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', async function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.id) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '送货单ID为必填项' }));
          return;
        }

        // 优先从MySQL删除
        if (mysqlPool) {
          try {
            const conn = await mysqlPool.getConnection();
            try {
              await conn.beginTransaction();
              // 先删除商品明细
              await conn.execute('DELETE FROM delivery_items WHERE delivery_id = ?', [data.id]);
              // 再删除送货单
              await conn.execute('DELETE FROM delivery_orders WHERE id = ?', [data.id]);
              await conn.commit();
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: true, message: '送货单删除成功' }));
              return;
            } catch (e) {
              await conn.rollback();
              throw e;
            } finally {
              conn.release();
            }
          } catch (e) {
            console.error('MySQL删除送货单失败:', e.message);
          }
        }

        // 回退到SQLite
        if (!usersDb) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库服务未启动' }));
          return;
        }
        usersDb.prepare('DELETE FROM delivery_notes WHERE id = ?').run(data.id);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '送货单删除成功' }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '删除送货单失败: ' + e.message }));
      }
    });

  // ==================== 出入库记录API ====================
  // 获取出入库记录列表：GET /api/inventory-records
  } else if (pathname === '/api/inventory-records' && req.method === 'GET') {
    const userId = parsedUrl.query.userId;
    if (!usersDb) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: [] }));
      return;
    }
    try {
      const records = usersDb.prepare('SELECT * FROM inventory_records WHERE user_id = ? ORDER BY create_time DESC').all(userId || '');
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: records }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '获取出入库记录失败: ' + e.message }));
    }
  // 添加出入库记录：POST /api/inventory-records
  } else if (pathname === '/api/inventory-records' && req.method === 'POST') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.record_no || !data.product_name || !data.type || !data.quantity || !data.unit || !data.date || !data.operator || !data.userId) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '记录编号、商品名称、类型、数量、单位、日期、操作人和用户ID为必填项' }));
          return;
        }
        if (!usersDb) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库服务未启动' }));
          return;
        }
        const now = new Date().toISOString();
        const stmt = usersDb.prepare(
          'INSERT INTO inventory_records (record_no, product_name, product_code, type, quantity, unit, date, operator, remark, user_id, create_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        const result = stmt.run(
          data.record_no,
          data.product_name,
          data.product_code || '',
          data.type,
          data.quantity,
          data.unit,
          data.date,
          data.operator,
          data.remark || '',
          data.userId,
          now
        );
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, data: { id: result.lastInsertRowid } }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '添加出入库记录失败: ' + e.message }));
      }
    });
  // 删除出入库记录：DELETE /api/inventory-records
  } else if (pathname === '/api/inventory-records' && req.method === 'DELETE') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.id) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '记录ID为必填项' }));
          return;
        }
        if (!usersDb) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库服务未启动' }));
          return;
        }
        usersDb.prepare('DELETE FROM inventory_records WHERE id = ?').run(data.id);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '出入库记录删除成功' }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '删除出入库记录失败: ' + e.message }));
      }
    });

  // ==================== 管理后台消息API ====================
  // 获取站内消息：GET /api/admin/messages
  } else if (pathname === '/api/admin/messages' && req.method === 'GET') {
    if (!usersDb) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: [] }));
      return;
    }
    try {
      const messages = usersDb.prepare('SELECT * FROM admin_notifications ORDER BY create_time DESC').all();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: messages }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '获取消息失败: ' + e.message }));
    }
  // 标记消息已读：POST /api/admin/messages/read
  } else if (pathname === '/api/admin/messages/read' && req.method === 'POST') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.id) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '消息ID为必填项' }));
          return;
        }
        if (!usersDb) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库服务未启动' }));
          return;
        }
        usersDb.prepare('UPDATE admin_notifications SET status = ? WHERE id = ?').run('read', data.id);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '消息已标记为已读' }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '标记消息失败: ' + e.message }));
      }
    });
  // 删除消息：POST /api/admin/messages/delete
  } else if (pathname === '/api/admin/messages/delete' && req.method === 'POST') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.id) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '消息ID为必填项' }));
          return;
        }
        if (!usersDb) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库服务未启动' }));
          return;
        }
        usersDb.prepare('DELETE FROM admin_notifications WHERE id = ?').run(data.id);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '消息已删除' }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '删除消息失败: ' + e.message }));
      }
    });

  // ==================== 蜻蜓Chat API ====================

  } else if (pathname === '/api/dragonfly/groups' && req.method === 'GET') {
    try {
      let groups = [];
      if (usersDb) {
        groups = usersDb.prepare('SELECT * FROM dragonfly_groups WHERE status = ? ORDER BY create_time DESC').all('active');
      } else {
        groups = dragonflyMemoryStore.groups;
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: groups }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: e.message }));
    }

  } else if (pathname === '/api/dragonfly/groups' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString('utf8'));
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.name || !data.creator_id) throw new Error('群组名称和创建者ID为必填项');

        const groupId = 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const group = {
          group_id: groupId,
          name: data.name,
          description: data.description || '',
          icon: data.icon || '👥',
          creator_id: data.creator_id,
          creator_name: data.creator_name || '创建者',
          max_members: 500,
          member_count: 1,
          status: 'active',
          create_time: new Date().toISOString(),
          update_time: new Date().toISOString()
        };

        if (usersDb) {
          usersDb.prepare(`
            INSERT INTO dragonfly_groups (group_id, name, description, icon, creator_id, creator_name, create_time, update_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(groupId, data.name, data.description || '', data.icon || '👥', data.creator_id, data.creator_name || '创建者', new Date().toISOString(), new Date().toISOString());
        } else {
          dragonflyMemoryStore.groups.push(group);
        }

        res.statusCode = 201;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '群组创建成功', group_id: groupId }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });

  } else if (pathname === '/api/dragonfly/circles' && req.method === 'GET') {
    try {
      let circles = [];
      if (usersDb) {
        circles = usersDb.prepare('SELECT * FROM dragonfly_circles WHERE status = ? ORDER BY create_time DESC').all('active');
      } else {
        circles = dragonflyMemoryStore.circles;
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: circles }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: e.message }));
    }

  } else if (pathname === '/api/dragonfly/circles' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString('utf8'));
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.name || !data.category || !data.creator_id) throw new Error('圈子名称、分类和创建者ID为必填项');

        const circleId = 'circle_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const circle = {
          circle_id: circleId,
          name: data.name,
          description: data.description || '',
          icon: data.icon || '⭐',
          category: data.category,
          creator_id: data.creator_id,
          creator_name: data.creator_name || '创建者',
          max_users: 500,
          member_count: 1,
          tags: JSON.stringify(data.tags || []),
          status: 'active',
          create_time: new Date().toISOString(),
          update_time: new Date().toISOString()
        };

        if (usersDb) {
          usersDb.prepare(`
            INSERT INTO dragonfly_circles (circle_id, name, description, icon, category, creator_id, creator_name, tags, create_time, update_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(circleId, data.name, data.description || '', data.icon || '⭐', data.category, data.creator_id, data.creator_name || '创建者', JSON.stringify(data.tags || []), new Date().toISOString(), new Date().toISOString());
        } else {
          dragonflyMemoryStore.circles.push(circle);
        }

        res.statusCode = 201;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '圈子创建成功', circle_id: circleId }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });

  } else if (pathname.startsWith('/api/dragonfly/groups/') && pathname.endsWith('/members') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString('utf8'));
    req.on('end', () => {
      try {
        const groupId = pathname.split('/')[4];
        const data = JSON.parse(body || '{}');
        if (!data.user_id) throw new Error('用户ID为必填项');

        if (usersDb) {
          usersDb.prepare(`
            INSERT OR IGNORE INTO dragonfly_group_members (group_id, user_id, user_name, join_time)
            VALUES (?, ?, ?, ?)
          `).run(groupId, data.user_id, data.user_name || '用户', new Date().toISOString());
          usersDb.prepare('UPDATE dragonfly_groups SET member_count = (SELECT COUNT(*) FROM dragonfly_group_members WHERE group_id = ?) WHERE group_id = ?').run(groupId, groupId);
        } else {
          if (!dragonflyMemoryStore.groupMembers[groupId]) {
            dragonflyMemoryStore.groupMembers[groupId] = [];
          }
          if (!dragonflyMemoryStore.groupMembers[groupId].find(m => m.user_id === data.user_id)) {
            dragonflyMemoryStore.groupMembers[groupId].push({
              user_id: data.user_id,
              user_name: data.user_name || '用户',
              join_time: new Date().toISOString()
            });
          }
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '已加入群组' }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });

  } else if (pathname.startsWith('/api/dragonfly/circles/') && pathname.endsWith('/members') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString('utf8'));
    req.on('end', () => {
      try {
        const circleId = pathname.split('/')[4];
        const data = JSON.parse(body || '{}');
        if (!data.user_id) throw new Error('用户ID为必填项');

        if (usersDb) {
          usersDb.prepare(`
            INSERT OR IGNORE INTO dragonfly_circle_members (circle_id, user_id, user_name, join_time)
            VALUES (?, ?, ?, ?)
          `).run(circleId, data.user_id, data.user_name || '用户', new Date().toISOString());
          usersDb.prepare('UPDATE dragonfly_circles SET member_count = (SELECT COUNT(*) FROM dragonfly_circle_members WHERE circle_id = ?) WHERE circle_id = ?').run(circleId, circleId);
        } else {
          if (!dragonflyMemoryStore.circleMembers[circleId]) {
            dragonflyMemoryStore.circleMembers[circleId] = [];
          }
          if (!dragonflyMemoryStore.circleMembers[circleId].find(m => m.user_id === data.user_id)) {
            dragonflyMemoryStore.circleMembers[circleId].push({
              user_id: data.user_id,
              user_name: data.user_name || '用户',
              join_time: new Date().toISOString()
            });
          }
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '已加入圈子' }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });

  } else if (pathname === '/api/dragonfly/messages' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString('utf8'));
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.type || !data.target_id || !data.user_id || !data.content) throw new Error('消息类型、目标ID、用户ID和内容为必填项');

        const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const message = {
          message_id: messageId,
          type: data.type,
          target_id: data.target_id,
          user_id: data.user_id,
          user_name: data.user_name || '用户',
          content: data.content,
          create_time: new Date().toISOString()
        };

        if (usersDb) {
          usersDb.prepare(`
            INSERT INTO dragonfly_messages (message_id, type, target_id, user_id, user_name, content, create_time)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(messageId, data.type, data.target_id, data.user_id, data.user_name || '用户', data.content, new Date().toISOString());
        } else {
          dragonflyMemoryStore.messages.push(message);
        }

        res.statusCode = 201;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '消息已保存', message_id: messageId }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });

  // ============================================================
  // OCR API - 图片识别转文字/表格
  // ============================================================
  } else if (pathname === '/api/ocr/general' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString('utf8'));
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.image) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '请提供图片数据' }));
          return;
        }

        // 调用阿里云OCR API
        const ocrResult = await callAliyunOcr(data.image, 'general');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(ocrResult));
      } catch (e) {
        console.error('OCR识别失败:', e);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: 'OCR识别失败: ' + e.message }));
      }
    });

  } else if (pathname === '/api/ocr/word' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString('utf8'));
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.image) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '请提供图片数据' }));
          return;
        }

        const ocrResult = await callAliyunOcr(data.image, 'general');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(ocrResult));
      } catch (e) {
        console.error('OCR识别失败:', e);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: 'OCR识别失败: ' + e.message }));
      }
    });

  } else if (pathname === '/api/ocr/excel' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk.toString('utf8'));
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.image) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '请提供图片数据' }));
          return;
        }

        const ocrResult = await callAliyunOcr(data.image, 'table');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(ocrResult));
      } catch (e) {
        console.error('OCR识别失败:', e);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: 'OCR识别失败: ' + e.message }));
      }
    });

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

// 初始化数据库
initMainDb();

const PORT = process.env.PORT || 5098;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================`);
  console.log(`支付服务器已启动`);
  console.log(`服务地址: http://0.0.0.0:${PORT}`);
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
  console.log(`  GET  /api/accounts/:id/backups - 获取备份列表`);
  console.log(`  POST /api/accounts/:id/restore - 恢复备份`);
  console.log(`========================================\n`);
});
