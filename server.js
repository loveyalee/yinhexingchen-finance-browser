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
// 阿里云 OCR SDK
// ============================================================
let OcrApi;
try {
  OcrApi = require('@alicloud/ocr-api20210707');
} catch (e) {
  console.warn('阿里云 OCR SDK 未安装，OCR功能将不可用:', e.message);
}

// ============================================================
// 阿里云 OCR 配置（用于工具箱图片转Excel功能）
// ============================================================
// 使用环境变量配置敏感信息
const ALIYUN_ACCESS_KEY_ID = process.env.ALIYUN_ACCESS_KEY_ID || '';
const ALIYUN_ACCESS_KEY_SECRET = process.env.ALIYUN_ACCESS_KEY_SECRET || '';
const ALIYUN_REGION = 'cn-hangzhou';
const ALIYUN_ENDPOINT = 'ocr-api.cn-hangzhou.aliyuncs.com';
console.log('阿里云OCR已配置: ' + (ALIYUN_ACCESS_KEY_ID ? ALIYUN_ACCESS_KEY_ID.substring(0, 6) + '****' : '未配置'));

// 创建 OCR 客户端
function createOcrClient() {
  if (!OcrApi || !OpenApi) {
    return null;
  }
  const config = new OpenApi.Config({
    accessKeyId: process.env.ALIYUN_SMS_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIYUN_SMS_ACCESS_KEY_SECRET,
    endpoint: 'ocr-api.cn-hangzhou.aliyuncs.com'
  });
  return new OcrApi(config);
}

// 解析表格单元格数据为二维数组
function parseTableData(cells) {
  if (!cells || !Array.isArray(cells)) return [];

  const maxRow = Math.max(...cells.map(c => c.rowIndex || 0)) + 1;
  const maxCol = Math.max(...cells.map(c => c.colIndex || 0)) + 1;

  const tableData = [];
  for (let i = 0; i < maxRow; i++) {
    tableData[i] = new Array(maxCol).fill('');
  }

  cells.forEach(cell => {
    const row = cell.rowIndex || 0;
    const col = cell.colIndex || 0;
    if (row < maxRow && col < maxCol) {
      tableData[row][col] = cell.text || '';
    }
  });

  return tableData;
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
    host: process.env.MYSQL_HOST,
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    database: process.env.MYSQL_DATABASE,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
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
        INDEX idx_ban_status (ban_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 修改唯一索引：个人用户手机号唯一，企业用户用户名唯一
    // MySQL不支持条件索引，删除旧索引后依靠应用逻辑检查唯一性
    try {
      // 先删除旧的唯一索引
      await conn.execute(`ALTER TABLE users DROP INDEX idx_personal_phone`);
      console.log('已删除旧的唯一索引 idx_personal_phone');
    } catch (e) {
      // 索引可能不存在，忽略错误
    }

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
        customer_phone VARCHAR(20),
        customer_address VARCHAR(255),
        delivery_date DATE NOT NULL,
        contact VARCHAR(100) DEFAULT '',
        project VARCHAR(200) DEFAULT '',
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

    // 兼容旧表：按需添加新增字段
    try { await conn.execute(`ALTER TABLE delivery_orders ADD COLUMN project VARCHAR(200) DEFAULT ''`); } catch(e) {}
    try { await conn.execute(`ALTER TABLE delivery_orders ADD COLUMN contact VARCHAR(100) DEFAULT ''`); } catch(e) {}

    // 送货单明细表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS delivery_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        delivery_id INT NOT NULL,
        product_name VARCHAR(200) NOT NULL,
        model VARCHAR(100) DEFAULT '',
        length VARCHAR(50) DEFAULT '',
        wattage VARCHAR(50) DEFAULT '',
        brightness VARCHAR(50) DEFAULT '',
        sensor_mode VARCHAR(50) DEFAULT '',
        quantity DECIMAL(10,2) DEFAULT 1,
        unit VARCHAR(20) DEFAULT '个',
        unit_price DECIMAL(10,2) DEFAULT 0,
        amount DECIMAL(10,2) DEFAULT 0,
        remark TEXT,
        INDEX idx_delivery_id (delivery_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 兼容旧表：按需添加新增字段
    try { await conn.execute(`ALTER TABLE delivery_items ADD COLUMN model VARCHAR(100) DEFAULT ''`); } catch(e) {}
    try { await conn.execute(`ALTER TABLE delivery_items ADD COLUMN length VARCHAR(50) DEFAULT ''`); } catch(e) {}
    try { await conn.execute(`ALTER TABLE delivery_items ADD COLUMN wattage VARCHAR(50) DEFAULT ''`); } catch(e) {}
    try { await conn.execute(`ALTER TABLE delivery_items ADD COLUMN brightness VARCHAR(50) DEFAULT ''`); } catch(e) {}
    try { await conn.execute(`ALTER TABLE delivery_items ADD COLUMN sensor_mode VARCHAR(50) DEFAULT ''`); } catch(e) {}
    try { await conn.execute(`ALTER TABLE delivery_items ADD COLUMN unit VARCHAR(20) DEFAULT '个'`); } catch(e) {}

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
    try { await conn.execute(`ALTER TABLE users ADD COLUMN real_name VARCHAR(50)`); } catch(e) {}
    try { await conn.execute(`ALTER TABLE users ADD COLUMN id_type VARCHAR(20) DEFAULT 'idcard'`); } catch(e) {}
    try { await conn.execute(`ALTER TABLE users ADD COLUMN id_number VARCHAR(50)`); } catch(e) {}
    try { await conn.execute(`ALTER TABLE users ADD COLUMN is_verified TINYINT DEFAULT 0`); } catch(e) {}

    // 云盘文件表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS cloud_files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        size BIGINT DEFAULT 0,
        folder_id INT DEFAULT 0,
        category VARCHAR(50) DEFAULT 'all',
        description TEXT,
        share_link VARCHAR(255),
        share_password VARCHAR(50),
        share_expiry DATETIME,
        is_shared TINYINT DEFAULT 0,
        create_time DATETIME NOT NULL,
        update_time DATETIME NOT NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_category (category),
        INDEX idx_folder_id (folder_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 云盘文件夹表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS cloud_folders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        name VARCHAR(255) NOT NULL,
        parent_id INT DEFAULT 0,
        create_time DATETIME NOT NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_parent_id (parent_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 论坛帖子表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS forum_posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        author_id VARCHAR(64) NOT NULL,
        author_name VARCHAR(100) NOT NULL,
        category VARCHAR(20) DEFAULT 'other',
        tags TEXT,
        views INT DEFAULT 0,
        likes INT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'published',
        create_time DATETIME NOT NULL,
        update_time DATETIME NOT NULL,
        INDEX idx_category (category),
        INDEX idx_status (status),
        INDEX idx_create_time (create_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 论坛评论表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS forum_comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        author_id VARCHAR(64) NOT NULL,
        author_name VARCHAR(100) NOT NULL,
        content TEXT NOT NULL,
        likes INT DEFAULT 0,
        create_time DATETIME NOT NULL,
        INDEX idx_post_id (post_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 论坛点赞表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS forum_likes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        create_time DATETIME NOT NULL,
        UNIQUE KEY uk_post_user (post_id, user_id),
        INDEX idx_post_id (post_id),
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 论坛收藏表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS forum_bookmarks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        create_time DATETIME NOT NULL,
        UNIQUE KEY uk_post_user (post_id, user_id),
        INDEX idx_post_id (post_id),
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 知识库文章表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS knowledge_articles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        author VARCHAR(100),
        category VARCHAR(20) DEFAULT 'other',
        views INT DEFAULT 0,
        likes INT DEFAULT 0,
        status VARCHAR(20) DEFAULT 'published',
        create_time DATETIME NOT NULL,
        INDEX idx_category (category),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 用户交易记录表
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS user_transactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        type VARCHAR(20) NOT NULL,
        amount DECIMAL(10,2) DEFAULT 0,
        balance DECIMAL(10,2) DEFAULT 0,
        description VARCHAR(255),
        status VARCHAR(20) DEFAULT 'completed',
        create_time DATETIME NOT NULL,
        INDEX idx_user_id (user_id),
        INDEX idx_type (type),
        INDEX idx_create_time (create_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

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
      try { usersDb.exec(`DROP INDEX IF EXISTS idx_personal_phone`); } catch (e) {}
      try { usersDb.exec(`DROP INDEX IF EXISTS idx_username`); } catch (e) {}
      try { usersDb.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_personal_phone_unique ON users(phone) WHERE user_type = 'personal'`); } catch (e) {}
      try { usersDb.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_enterprise_username ON users(username) WHERE user_type = 'enterprise'`); } catch (e) {}
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

      // 创建模板表
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          template_id TEXT UNIQUE NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          category TEXT NOT NULL,
          industry TEXT,
          format TEXT DEFAULT 'Excel',
          icon TEXT DEFAULT '📄',
          download_count INTEGER DEFAULT 0,
          file_path TEXT,
          status TEXT DEFAULT 'active',
          create_time TEXT NOT NULL,
          update_time TEXT
        );
      `);

      // 创建工具表
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS tools (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tool_id TEXT UNIQUE NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          icon TEXT DEFAULT '🔧',
          category TEXT,
          status TEXT DEFAULT 'active',
          create_time TEXT NOT NULL,
          update_time TEXT
        );
      `);

      // 创建会员套餐表
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS membership_plans (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          plan_id TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          duration_days INTEGER NOT NULL,
          price INTEGER NOT NULL,
          original_price INTEGER,
          features TEXT,
          status TEXT DEFAULT 'active',
          create_time TEXT NOT NULL
        );
      `);

      // 创建用户会员表
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS user_memberships (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          plan_id TEXT NOT NULL,
          order_id TEXT,
          start_time TEXT NOT NULL,
          end_time TEXT NOT NULL,
          status TEXT DEFAULT 'active',
          payment_method TEXT,
          amount INTEGER,
          create_time TEXT NOT NULL
        );
      `);

      // 初始化会员套餐数据
      const existingPlans = usersDb.prepare('SELECT COUNT(*) as count FROM membership_plans').get();
      if (existingPlans.count === 0) {
        const plans = [
          { plan_id: 'monthly', name: '月卡会员', description: '畅享30天会员权益', duration_days: 30, price: 4500, original_price: 5900, features: JSON.stringify(['无限使用所有功能', '优先客服支持', '数据云备份', '专属会员标识']) },
          { plan_id: 'quarterly', name: '季卡会员', description: '畅享90天会员权益', duration_days: 90, price: 10800, original_price: 17700, features: JSON.stringify(['无限使用所有功能', '优先客服支持', '数据云备份', '专属会员标识', '季度财务报告']) },
          { plan_id: 'yearly', name: '年卡会员', description: '畅享365天会员权益', duration_days: 365, price: 19900, original_price: 39900, features: JSON.stringify(['无限使用所有功能', '专属客服支持', '数据云备份', '专属会员标识', '年度财务报告', '免费升级新功能']) }
        ];
        const insertPlan = usersDb.prepare('INSERT INTO membership_plans (plan_id, name, description, duration_days, price, original_price, features, create_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        for (const plan of plans) {
          insertPlan.run(plan.plan_id, plan.name, plan.description, plan.duration_days, plan.price, plan.original_price, plan.features, new Date().toISOString());
        }
        console.log('会员套餐数据初始化完成');
      }

      // 创建论坛帖子表
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS forum_posts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          author_id TEXT NOT NULL,
          author_name TEXT NOT NULL,
          category TEXT DEFAULT 'other',
          tags TEXT,
          views INTEGER DEFAULT 0,
          likes INTEGER DEFAULT 0,
          status TEXT DEFAULT 'published',
          create_time TEXT NOT NULL,
          update_time TEXT NOT NULL
        );
      `);

      // 创建帖子评论表
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS forum_comments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          post_id INTEGER NOT NULL,
          author_id TEXT NOT NULL,
          author_name TEXT NOT NULL,
          content TEXT NOT NULL,
          likes INTEGER DEFAULT 0,
          create_time TEXT NOT NULL
        );
      `);

      // 创建帖子点赞表
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS forum_likes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          post_id INTEGER NOT NULL,
          user_id TEXT NOT NULL,
          create_time TEXT NOT NULL,
          UNIQUE(post_id, user_id)
        );
      `);

      // 创建帖子收藏表
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS forum_bookmarks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          post_id INTEGER NOT NULL,
          user_id TEXT NOT NULL,
          create_time TEXT NOT NULL,
          UNIQUE(post_id, user_id)
        );
      `);

      // 创建知识库文章表
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS knowledge_articles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          author TEXT,
          category TEXT DEFAULT 'other',
          views INTEGER DEFAULT 0,
          likes INTEGER DEFAULT 0,
          status TEXT DEFAULT 'published',
          create_time TEXT NOT NULL
        );
      `);

      // 创建云盘文件表
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS cloud_files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          type TEXT NOT NULL,
          size INTEGER DEFAULT 0,
          folder_id INTEGER DEFAULT 0,
          category TEXT DEFAULT 'all',
          description TEXT,
          share_link TEXT,
          share_password TEXT,
          share_expiry TEXT,
          is_shared INTEGER DEFAULT 0,
          create_time TEXT NOT NULL,
          update_time TEXT NOT NULL
        );
      `);

      // 创建云盘文件夹表
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS cloud_folders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          parent_id INTEGER DEFAULT 0,
          create_time TEXT NOT NULL
        );
      `);

      // 创建用户交易记录表
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS user_transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          amount REAL DEFAULT 0,
          balance REAL DEFAULT 0,
          description TEXT,
          status TEXT DEFAULT 'completed',
          create_time TEXT NOT NULL
        );
      `);

      // 初始化示例帖子数据
      const existingPosts = usersDb.prepare('SELECT COUNT(*) as count FROM forum_posts').get();
      if (existingPosts.count === 0) {
        const posts = [
          { title: '如何做好企业财务分析？', content: '作为财务人员，如何进行有效的企业财务分析？需要关注哪些关键指标？有什么实用的分析方法和技巧？欢迎大家分享经验。', author_id: 'user001', author_name: '财务专家', category: 'finance', tags: JSON.stringify(['财务分析', '财务管理']), views: 156, likes: 25 },
          { title: '税务筹划的常见方法有哪些？', content: '企业在合法范围内如何进行税务筹划？有哪些实用的方法和技巧？希望能得到专业人士的指导。', author_id: 'user002', author_name: '税务顾问', category: 'tax', tags: JSON.stringify(['税务筹划', '增值税', '企业所得税']), views: 203, likes: 18 },
          { title: '财务软件选择指南', content: '如何选择适合企业的财务软件？需要考虑哪些因素？市面上主流的财务软件有哪些优缺点？', author_id: 'user003', author_name: 'IT顾问', category: 'accounting', tags: JSON.stringify(['财务软件', '会计']), views: 289, likes: 32 },
          { title: '年度审计准备工作要点', content: '马上要年度审计了，需要准备哪些资料？有哪些注意事项？如何与审计师有效沟通？', author_id: 'user004', author_name: '审计专员', category: 'audit', tags: JSON.stringify(['审计', '内部控制', '年度审计']), views: 312, likes: 45 },
          { title: '增值税发票开具注意事项', content: '开具增值税发票时有哪些注意事项？发票抬头、税号、金额等信息如何核对？', author_id: 'user005', author_name: '开票员', category: 'tax', tags: JSON.stringify(['发票', '增值税']), views: 178, likes: 28 },
          { title: '企业预算编制流程分享', content: '分享一套完整的企业预算编制流程，包括预算编制、执行、监控和调整四个阶段。', author_id: 'user006', author_name: '财务经理', category: 'finance', tags: JSON.stringify(['预算管理', '财务管理']), views: 421, likes: 56 },
          { title: '新会计准则变化解读', content: '最新会计准则有哪些重要变化？对企业财务报表有什么影响？如何应对这些变化？', author_id: 'user007', author_name: '会计专家', category: 'accounting', tags: JSON.stringify(['会计准则', '财务报表']), views: 534, likes: 67 },
          { title: '报销流程优化建议', content: '公司报销流程比较繁琐，想请教各位有没有好的优化建议？如何在合规的前提下提高效率？', author_id: 'user008', author_name: '行政主管', category: 'other', tags: JSON.stringify(['报销', '流程优化']), views: 145, likes: 23 }
        ];
        const insertPost = usersDb.prepare('INSERT INTO forum_posts (title, content, author_id, author_name, category, tags, views, likes, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        const now = new Date().toISOString();
        for (const post of posts) {
          insertPost.run(post.title, post.content, post.author_id, post.author_name, post.category, post.tags, post.views, post.likes, now, now);
        }

        // 添加示例评论
        const insertComment = usersDb.prepare('INSERT INTO forum_comments (post_id, author_id, author_name, content, create_time) VALUES (?, ?, ?, ?, ?)');
        insertComment.run(1, 'user010', '会计小白', '我觉得应该关注盈利能力、运营能力和偿债能力三大指标。', now);
        insertComment.run(1, 'user011', '财务经理', '除了财务指标，还要结合行业特点和企业战略进行分析', now);
        insertComment.run(2, 'user012', '企业会计', '希望能分享一些具体的案例', now);
        insertComment.run(4, 'user013', '财务总监', '建议提前整理好凭证、合同、银行对账单等核心资料。', now);
        insertComment.run(6, 'user014', '预算专员', '非常详细，学习了！', now);
        insertComment.run(6, 'user015', '会计新人', '请问预算执行差异分析怎么做？', now);

        console.log('论坛帖子数据初始化完成');
      }

      // 初始化知识库文章数据
      const existingArticles = usersDb.prepare('SELECT COUNT(*) as count FROM knowledge_articles').get();
      if (existingArticles.count === 0) {
        const articles = [
          { title: '企业会计准则解读', content: '详细解读最新企业会计准则的变化和应用', author: '会计准则专家', category: 'accounting', views: 320, likes: 45 },
          { title: '财务报表编制指南', content: '手把手教你编制规范的财务报表', author: '财务总监', category: 'finance', views: 280, likes: 38 },
          { title: '税务申报实务', content: '各类税种的申报流程和注意事项', author: '税务专家', category: 'tax', views: 450, likes: 62 }
        ];
        const insertArticle = usersDb.prepare('INSERT INTO knowledge_articles (title, content, author, category, views, likes, create_time) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const now = new Date().toISOString();
        for (const article of articles) {
          insertArticle.run(article.title, article.content, article.author, article.category, article.views, article.likes, now);
        }
        console.log('知识库文章数据初始化完成');
      }

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
  const xujianCode = process.env.XUJIAN_CODE || '';

  // 优先使用企查查API（数据更全面）
  if (qccApiKey) {
    searchFromQcc(keyword, qccApiKey, function(err, results) {
      if (!err && results && results.length > 0) {
        callback(null, results);
        return;
      }
      // 企查查失败，尝试数字续坚
      if (xujianCode) {
        searchFromXujian(keyword, xujianCode, function(err2, results2) {
          if (!err2 && results2 && results2.length > 0) {
            callback(null, results2);
            return;
          }
          // 数字续坚也失败，尝试天眼查
          if (tianyanchaApiKey) {
            searchFromTianyancha(keyword, tianyanchaApiKey, callback);
          } else {
            searchEnterpriseFromPublicAPI(keyword, callback);
          }
        });
      } else if (tianyanchaApiKey) {
        searchFromTianyancha(keyword, tianyanchaApiKey, callback);
      } else {
        searchEnterpriseFromPublicAPI(keyword, callback);
      }
    });
    return;
  }

  // 没有企查查，尝试数字续坚
  if (xujianCode) {
    searchFromXujian(keyword, xujianCode, function(err, results) {
      if (!err && results && results.length > 0) {
        callback(null, results);
        return;
      }
      if (tianyanchaApiKey) {
        searchFromTianyancha(keyword, tianyanchaApiKey, callback);
      } else {
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

  // 企查查API签名认证（官方格式）
  const timespan = Math.floor(Date.now() / 1000).toString();
  const signStr = apiKey + timespan + secretKey;
  const token = crypto.createHash('md5').update(signStr).digest('hex').toUpperCase();

  console.log('[企查查] 搜索关键词:', keyword);
  console.log('[企查查] Token:', token);

  // 企查查模糊搜索API - 使用正确的参数名 searchKey
  const options = {
    hostname: 'api.qichacha.com',
    path: '/FuzzySearch/GetList?key=' + apiKey + '&searchKey=' + encodeURIComponent(keyword),
    method: 'GET',
    headers: {
      'Token': token,
      'Timespan': timespan
    }
  };

  console.log('[企查查] 请求URL:', 'http://' + options.hostname + options.path);

  const req = http.request(options, function(res) {
    let data = '';
    res.on('data', function(chunk) { data += chunk; });
    res.on('end', function() {
      console.log('[企查查] 状态码:', res.statusCode);
      console.log('[企查查] 响应:', data.substring(0, 800));

      try {
        const result = JSON.parse(data);
        if (result.Status === '200' && result.Result && result.Result.length > 0) {
          const enterprises = result.Result.map(function(item) {
            return {
              name: item.Name || '',
              creditCode: item.CreditCode || item.No || '',
              legalPerson: item.OperName || '',
              address: item.Address || '',
              status: item.Status || '',
              regCapital: item.RegCapital || '',
              startDate: item.StartDate || '',
              businessScope: item.Scope || '',
              keyNo: item.KeyNo || '',
              source: 'qcc'
            };
          });
          console.log('[企查查] 成功获取', enterprises.length, '条数据');
          callback(null, enterprises);
        } else if (result.Message) {
          console.log('[企查查] API返回:', result.Message);
          callback(new Error(result.Message), null);
        } else {
          console.log('[企查查] 未找到数据');
          callback(new Error('未找到相关企业'), null);
        }
      } catch (e) {
        console.log('[企查查] 解析失败:', e.message);
        callback(e, null);
      }
    });
  });

  req.on('error', function(e) {
    console.log('[企查查] 错误:', e.message);
    callback(e, null);
  });

  req.setTimeout(10000, function() {
    req.destroy();
    console.log('[企查查] 超时');
    callback(new Error('企查查请求超时'), null);
  });

  req.end();
}

// 数字续坚平台API搜索（企查查备选方案，免费每天20次）
function searchFromXujian(keyword, code, callback) {
  // keyword最少4个字符
  if (keyword.length < 4) {
    console.log('[数字续坚] 关键词不足4字，跳过');
    callback(new Error('关键词不足4字'), null);
    return;
  }

  console.log('[数字续坚] 搜索关键词:', keyword);

  const options = {
    hostname: 'www.xujian.tech',
    path: '/atlapi/data/c/query/like?keyword=' + encodeURIComponent(keyword) + '&code=' + encodeURIComponent(code),
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0'
    }
  };

  const req = https.request(options, function(res) {
    let data = '';
    res.on('data', function(chunk) { data += chunk; });
    res.on('end', function() {
      console.log('[数字续坚] 状态码:', res.statusCode);
      console.log('[数字续坚] 响应:', data.substring(0, 500));

      try {
        const result = JSON.parse(data);
        if (result.code === 200 && result.data && result.data.length > 0) {
          const enterprises = result.data.map(function(item) {
            return {
              name: item.name || '',
              creditCode: item.creditNo || '',
              legalPerson: item.operName || '',
              address: '',
              status: '',
              regCapital: '',
              startDate: item.startDate || '',
              businessScope: '',
              keyNo: item.qxbId || '',
              source: 'xujian'
            };
          });
          console.log('[数字续坚] 成功获取', enterprises.length, '条数据');
          callback(null, enterprises);
        } else if (result.msg) {
          console.log('[数字续坚] API返回:', result.msg);
          callback(new Error(result.msg), null);
        } else {
          console.log('[数字续坚] 未找到数据');
          callback(new Error('未找到相关企业'), null);
        }
      } catch (e) {
        console.log('[数字续坚] 解析失败:', e.message);
        callback(e, null);
      }
    });
  });

  req.on('error', function(e) {
    console.log('[数字续坚] 请求失败:', e.message);
    callback(e, null);
  });

  req.setTimeout(10000, function() {
    req.destroy();
    console.log('[数字续坚] 请求超时');
    callback(new Error('请求超时'), null);
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
    // 匹配 <key>value</key> 或 <key><![CDATA[value]]></key>
    const regex = /<([^>]+)>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/\1>/g;
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
  },

  // 调用微信统一下单API
  unifiedOrder: async function(params) {
    return new Promise((resolve, reject) => {
      const xml = this.jsonToXml(params);

      const options = {
        hostname: 'api.mch.weixin.qq.com',
        port: 443,
        path: '/pay/unifiedorder',
        method: 'POST',
        headers: {
          'Content-Type': 'application/xml',
          'Content-Length': Buffer.byteLength(xml)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = this.xmlToJson(data);
            resolve(result);
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.write(xml);
      req.end();
    });
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

            // 如果是会员订单，开通会员
            if (orders[orderId].planId && usersDb) {
              activateMembership(orders[orderId]);
            }

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

            // 如果是会员订单，开通会员
            if (orders[orderId].planId && usersDb) {
              activateMembership(orders[orderId]);
            }

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

  } else if (pathname === '/api/tax/reporting-progress' && req.method === 'GET') {
    // 获取税务申报进度
    try {
      if (!usersDb) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, data: [] }));
        return;
      }

      // 确保表存在
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS tax_reporting_progress (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tax_type TEXT NOT NULL,
          period TEXT NOT NULL,
          status TEXT DEFAULT 'pending',
          amount REAL DEFAULT 0,
          deadline TEXT,
          report_date TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 查询数据
      const rows = usersDb.prepare(`SELECT * FROM tax_reporting_progress ORDER BY deadline ASC`).all();

      // 如果没有数据，插入示例数据
      if (!rows || rows.length === 0) {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        const sampleData = [
          { tax_type: '增值税', period: `${currentYear}年${currentMonth}月`, status: 'completed', amount: 12500, deadline: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-15`, report_date: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-10` },
          { tax_type: '企业所得税', period: `${currentYear}年第一季度`, status: 'pending', amount: 35000, deadline: `${currentYear}-04-15`, report_date: null },
          { tax_type: '个人所得税', period: `${currentYear}年${currentMonth}月`, status: 'processing', amount: 8200, deadline: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-15`, report_date: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-05` }
        ];

        const stmt = usersDb.prepare(`INSERT INTO tax_reporting_progress (tax_type, period, status, amount, deadline, report_date) VALUES (?, ?, ?, ?, ?, ?)`);
        const insertMany = usersDb.transaction((items) => {
          for (const item of items) {
            stmt.run(item.tax_type, item.period, item.status, item.amount, item.deadline, item.report_date);
          }
        });
        insertMany(sampleData);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, data: sampleData }));
      } else {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, data: rows }));
      }
    } catch (e) {
      console.error('获取申报进度失败:', e.message);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '获取申报进度失败: ' + e.message }));
    }

  } else if (pathname === '/api/tax/fetch-sales' && req.method === 'GET') {
    // 从电子税务局获取销售收入
    try {
      const taxType = parsedUrl.query.taxType || 'vat';
      const period = parsedUrl.query.period || '';
      const province = parsedUrl.query.province || process.env.TAX_BUREAU_PROVINCE || 'hunan';

      if (!period) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '请提供申报期间' }));
        return;
      }

      console.log('[电子税务局] 获取销售收入:', province, taxType, period);

      // 各省份电子税务局配置
      const taxBureauConfig = {
        'hunan': {
          name: '湖南省电子税务局',
          baseUrl: 'https://etax.hunan.chinatax.gov.cn',
          // 需要配置实际的API端点
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'guangdong': {
          name: '广东省电子税务局',
          baseUrl: 'https://etax.guangdong.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'beijing': {
          name: '北京市电子税务局',
          baseUrl: 'https://etax.beijing.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'shanghai': {
          name: '上海市电子税务局',
          baseUrl: 'https://etax.shanghai.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'zhejiang': {
          name: '浙江省电子税务局',
          baseUrl: 'https://etax.zj.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'jiangsu': {
          name: '江苏省电子税务局',
          baseUrl: 'https://etax.jiangsu.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'sichuan': {
          name: '四川省电子税务局',
          baseUrl: 'https://etax.sichuan.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'hubei': {
          name: '湖北省电子税务局',
          baseUrl: 'https://etax.hubei.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'henan': {
          name: '河南省电子税务局',
          baseUrl: 'https://etax.henan.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'shandong': {
          name: '山东省电子税务局',
          baseUrl: 'https://etax.shandong.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'fujian': {
          name: '福建省电子税务局',
          baseUrl: 'https://etax.fujian.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'anhui': {
          name: '安徽省电子税务局',
          baseUrl: 'https://etax.ah.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'chongqing': {
          name: '重庆市电子税务局',
          baseUrl: 'https://etax.chongqing.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'tianjin': {
          name: '天津市电子税务局',
          baseUrl: 'https://etax.tianjin.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'hebei': {
          name: '河北省电子税务局',
          baseUrl: 'https://etax.hebei.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'liaoning': {
          name: '辽宁省电子税务局',
          baseUrl: 'https://etax.liaoning.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'jilin': {
          name: '吉林省电子税务局',
          baseUrl: 'https://etax.jl.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'heilongjiang': {
          name: '黑龙江省电子税务局',
          baseUrl: 'https://etax.hlj.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'jiangxi': {
          name: '江西省电子税务局',
          baseUrl: 'https://etax.jiangxi.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'guangxi': {
          name: '广西壮族自治区电子税务局',
          baseUrl: 'https://etax.guangxi.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'hainan': {
          name: '海南省电子税务局',
          baseUrl: 'https://etax.hainan.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'guizhou': {
          name: '贵州省电子税务局',
          baseUrl: 'https://etax.guizhou.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'yunnan': {
          name: '云南省电子税务局',
          baseUrl: 'https://etax.yunnan.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'shaanxi': {
          name: '陕西省电子税务局',
          baseUrl: 'https://etax.shaanxi.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'gansu': {
          name: '甘肃省电子税务局',
          baseUrl: 'https://etax.gansu.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'qinghai': {
          name: '青海省电子税务局',
          baseUrl: 'https://etax.qinghai.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'ningxia': {
          name: '宁夏回族自治区电子税务局',
          baseUrl: 'https://etax.ningxia.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'xinjiang': {
          name: '新疆维吾尔自治区电子税务局',
          baseUrl: 'https://etax.xinjiang.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'xizang': {
          name: '西藏自治区电子税务局',
          baseUrl: 'https://etax.xizang.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'neimenggu': {
          name: '内蒙古自治区电子税务局',
          baseUrl: 'https://etax.nm.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'shenzhen': {
          name: '深圳市电子税务局',
          baseUrl: 'https://etax.shenzhen.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'ningbo': {
          name: '宁波市电子税务局',
          baseUrl: 'https://etax.ningbo.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'xiamen': {
          name: '厦门市电子税务局',
          baseUrl: 'https://etax.xiamen.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'qingdao': {
          name: '青岛市电子税务局',
          baseUrl: 'https://etax.qingdao.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        },
        'dalian': {
          name: '大连市电子税务局',
          baseUrl: 'https://etax.dalian.chinatax.gov.cn',
          apiEndpoints: {
            sales: '/api/sb/sales/query',
            auth: '/api/auth/login'
          }
        }
      };

      const config = taxBureauConfig[province] || taxBureauConfig['hunan'];

      // 检查是否配置了电子税务局认证信息
      const taxBureauEnabled = process.env.TAX_BUREAU_ENABLED === 'true';
      const taxBureauToken = process.env.TAX_BUREAU_TOKEN || '';

      if (taxBureauEnabled && taxBureauToken) {
        // 实际调用电子税务局API
        const taxBureauApiUrl = config.baseUrl + config.apiEndpoints.sales;

        console.log('[电子税务局] 请求:', taxBureauApiUrl);

        const apiUrlParsed = new URL(taxBureauApiUrl);
        const taxReqOptions = {
          hostname: apiUrlParsed.hostname,
          port: apiUrlParsed.port || 443,
          path: apiUrlParsed.pathname + '?taxType=' + encodeURIComponent(taxType) + '&period=' + encodeURIComponent(period),
          method: 'GET',
          headers: {
            'Authorization': 'Bearer ' + taxBureauToken,
            'Content-Type': 'application/json',
            'User-Agent': 'YinheXingchen/1.0'
          }
        };

        const taxReq = https.request(taxReqOptions, function(taxRes) {
          let taxData = '';
          taxRes.on('data', function(chunk) { taxData += chunk; });
          taxRes.on('end', function() {
            try {
              console.log('[电子税务局] 响应:', taxRes.statusCode, taxData.substring(0, 500));
              if (taxRes.statusCode === 200) {
                const result = JSON.parse(taxData);
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify({
                  success: true,
                  data: {
                    salesAmount: result.salesAmount || result.data?.salesAmount,
                    taxableAmount: result.taxableAmount || result.data?.taxableAmount,
                    taxRate: result.taxRate || result.data?.taxRate,
                    source: config.name
                  },
                  message: '数据获取成功'
                }));
              } else {
                // API调用失败，返回模拟数据
                returnMockData();
              }
            } catch (e) {
              console.error('[电子税务局] 解析失败:', e.message);
              returnMockData();
            }
          });
        });

        taxReq.on('error', function(e) {
          console.error('[电子税务局] 请求失败:', e.message);
          returnMockData();
        });

        taxReq.setTimeout(10000, function() {
          taxReq.destroy();
          console.error('[电子税务局] 请求超时');
          returnMockData();
        });

        taxReq.end();

      } else {
        // 未配置真实API，返回模拟数据
        returnMockData();
      }

      function returnMockData() {
        // 模拟数据（实际生产环境需要对接真实的电子税务局API）
        const mockData = {
          'vat': {
            salesAmount: Math.floor(Math.random() * 500000) + 100000,
            taxableAmount: null,
            taxRate: 0.13,
            source: config.name + '（演示数据）'
          },
          'corporate-income': {
            salesAmount: Math.floor(Math.random() * 2000000) + 500000,
            taxableAmount: Math.floor(Math.random() * 200000) + 50000,
            taxRate: 0.25,
            source: config.name + '（演示数据）'
          },
          'personal-income': {
            salesAmount: null,
            taxableAmount: Math.floor(Math.random() * 30000) + 5000,
            taxRate: 0.03,
            source: config.name + '（演示数据）'
          },
          'city-tax': {
            salesAmount: null,
            taxableAmount: null,
            taxRate: 0.07,
            source: config.name + '（演示数据）'
          }
        };

        const data = mockData[taxType] || mockData['vat'];

        setTimeout(function() {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            success: true,
            data: data,
            message: '数据获取成功',
            province: config.name,
            note: '当前为演示数据，配置TAX_BUREAU_ENABLED=true后可对接真实API'
          }));
        }, 800);
      }

    } catch (e) {
      console.error('[电子税务局] 错误:', e);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '获取数据失败: ' + e.message }));
    }

  } else if (pathname === '/api/tax/provinces' && req.method === 'GET') {
    // 获取支持的省份列表
    const provinces = [
      { code: 'hunan', name: '湖南省' },
      { code: 'guangdong', name: '广东省' },
      { code: 'beijing', name: '北京市' },
      { code: 'shanghai', name: '上海市' },
      { code: 'zhejiang', name: '浙江省' },
      { code: 'jiangsu', name: '江苏省' },
      { code: 'sichuan', name: '四川省' },
      { code: 'hubei', name: '湖北省' },
      { code: 'henan', name: '河南省' },
      { code: 'shandong', name: '山东省' },
      { code: 'fujian', name: '福建省' },
      { code: 'anhui', name: '安徽省' },
      { code: 'chongqing', name: '重庆市' },
      { code: 'tianjin', name: '天津市' },
      { code: 'hebei', name: '河北省' },
      { code: 'liaoning', name: '辽宁省' },
      { code: 'jilin', name: '吉林省' },
      { code: 'heilongjiang', name: '黑龙江省' },
      { code: 'jiangxi', name: '江西省' },
      { code: 'guangxi', name: '广西壮族自治区' },
      { code: 'hainan', name: '海南省' },
      { code: 'guizhou', name: '贵州省' },
      { code: 'yunnan', name: '云南省' },
      { code: 'shaanxi', name: '陕西省' },
      { code: 'gansu', name: '甘肃省' },
      { code: 'qinghai', name: '青海省' },
      { code: 'ningxia', name: '宁夏回族自治区' },
      { code: 'xinjiang', name: '新疆维吾尔自治区' },
      { code: 'xizang', name: '西藏自治区' },
      { code: 'neimenggu', name: '内蒙古自治区' },
      { code: 'shenzhen', name: '深圳市' },
      { code: 'ningbo', name: '宁波市' },
      { code: 'xiamen', name: '厦门市' },
      { code: 'qingdao', name: '青岛市' },
      { code: 'dalian', name: '大连市' }
    ];
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ success: true, data: provinces }));

  } else if (pathname === '/api/tax/reporting-progress' && req.method === 'POST') {
    // 添加或更新申报进度
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', function() {
      try {
        if (!usersDb) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库不可用' }));
          return;
        }

        const data = JSON.parse(body || '{}');
        const { id, tax_type, period, status, amount, deadline, report_date } = data;

        // 确保表存在
        usersDb.exec(`
          CREATE TABLE IF NOT EXISTS tax_reporting_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tax_type TEXT NOT NULL,
            period TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            amount REAL DEFAULT 0,
            deadline TEXT,
            report_date TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        if (id) {
          // 更新
          usersDb.prepare(`UPDATE tax_reporting_progress SET tax_type = ?, period = ?, status = ?, amount = ?, deadline = ?, report_date = ?, updated_at = datetime('now') WHERE id = ?`)
            .run(tax_type, period, status, amount, deadline, report_date, id);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, message: '更新成功', id: id }));
        } else {
          // 新增
          const result = usersDb.prepare(`INSERT INTO tax_reporting_progress (tax_type, period, status, amount, deadline, report_date) VALUES (?, ?, ?, ?, ?, ?)`)
            .run(tax_type, period, status || 'pending', amount || 0, deadline, report_date);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, message: '添加成功', id: result.lastInsertRowid }));
        }
      } catch (e) {
        console.error('操作申报进度失败:', e.message);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '操作失败: ' + e.message }));
      }
    });

  } else if (pathname === '/api/tax/reporting-submit' && req.method === 'POST') {
    // 提交税务申报
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', function() {
      try {
        if (!usersDb) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库不可用' }));
          return;
        }

        const data = JSON.parse(body || '{}');
        const { tax_type, tax_type_label, period, period_label, sales_amount, taxable_amount, tax_rate, tax_amount, notes, status } = data;

        if (!tax_type || !period) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '税种和申报期间不能为空' }));
          return;
        }

        // 确保表存在
        usersDb.exec(`
          CREATE TABLE IF NOT EXISTS tax_filings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tax_type TEXT NOT NULL,
            tax_type_label TEXT,
            period TEXT NOT NULL,
            period_label TEXT,
            sales_amount REAL DEFAULT 0,
            taxable_amount REAL DEFAULT 0,
            tax_rate REAL DEFAULT 0,
            tax_amount REAL DEFAULT 0,
            notes TEXT,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        const result = usersDb.prepare(
          `INSERT INTO tax_filings (tax_type, tax_type_label, period, period_label, sales_amount, taxable_amount, tax_rate, tax_amount, notes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(tax_type, tax_type_label || '', period, period_label || '', sales_amount || 0, taxable_amount || 0, tax_rate || 0, tax_amount || 0, notes || '', status || 'pending');

        // 同时更新申报进度
        usersDb.exec(`
          CREATE TABLE IF NOT EXISTS tax_reporting_progress (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tax_type TEXT NOT NULL,
            period TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            amount REAL DEFAULT 0,
            deadline TEXT,
            report_date TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        const today = new Date().toISOString().split('T')[0];
        usersDb.prepare(
          `INSERT INTO tax_reporting_progress (tax_type, period, status, amount, report_date) VALUES (?, ?, ?, ?, ?)`
        ).run(tax_type_label || tax_type, period_label || period, 'pending', tax_amount || 0, today);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '申报提交成功', id: result.lastInsertRowid }));
      } catch (e) {
        console.error('提交税务申报失败:', e.message);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '提交失败: ' + e.message }));
      }
    });

  } else if (pathname === '/api/company/list' && req.method === 'GET') {
    // 获取公司列表
    try {
      if (!usersDb) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, data: [] }));
        return;
      }

      // 确保表存在
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS companies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          credit_code TEXT,
          legal_person TEXT,
          registered_capital REAL,
          establish_date TEXT,
          business_scope TEXT,
          address TEXT,
          phone TEXT,
          email TEXT,
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      const rows = usersDb.prepare(`SELECT * FROM companies ORDER BY created_at DESC`).all();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: rows || [] }));
    } catch (e) {
      console.error('获取公司列表失败:', e.message);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '获取公司列表失败: ' + e.message }));
    }

  } else if (pathname === '/api/company/save' && req.method === 'POST') {
    // 保存公司信息
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', function() {
      try {
        if (!usersDb) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库不可用' }));
          return;
        }

        const data = JSON.parse(body || '{}');
        const { id, name, credit_code, legal_person, registered_capital, establish_date, business_scope, address, phone, email } = data;

        // 确保表存在
        usersDb.exec(`
          CREATE TABLE IF NOT EXISTS companies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            credit_code TEXT,
            legal_person TEXT,
            registered_capital REAL,
            establish_date TEXT,
            business_scope TEXT,
            address TEXT,
            phone TEXT,
            email TEXT,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        if (id) {
          // 更新
          usersDb.prepare(`UPDATE companies SET name = ?, credit_code = ?, legal_person = ?, registered_capital = ?, establish_date = ?, business_scope = ?, address = ?, phone = ?, email = ?, updated_at = datetime('now') WHERE id = ?`)
            .run(name, credit_code, legal_person, registered_capital, establish_date, business_scope, address, phone, email, id);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, message: '更新成功', id: id }));
        } else {
          // 新增
          const result = usersDb.prepare(`INSERT INTO companies (name, credit_code, legal_person, registered_capital, establish_date, business_scope, address, phone, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(name, credit_code, legal_person, registered_capital, establish_date, business_scope, address, phone, email);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, message: '保存成功', id: result.lastInsertRowid }));
        }
      } catch (e) {
        console.error('保存公司信息失败:', e.message);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '保存失败: ' + e.message }));
      }
    });

  } else if (pathname === '/api/company/delete' && req.method === 'POST') {
    // 删除公司
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', function() {
      try {
        if (!usersDb) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库不可用' }));
          return;
        }

        const data = JSON.parse(body || '{}');
        const { id } = data;

        if (!id) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '缺少公司ID' }));
          return;
        }

        usersDb.prepare(`DELETE FROM companies WHERE id = ?`).run(id);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '删除成功' }));
      } catch (e) {
        console.error('删除公司失败:', e.message);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '删除失败: ' + e.message }));
      }
    });

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

      // 未登录用户返回演示数据
      if (!userId || userId === 'guest' || userId === 'demo') {
        const demoProducts = [
          { id: 1, name: '财务软件专业版', code: 'SP001', category: '软件', unit: '套', price: 2999, stock: 45, threshold: 10 },
          { id: 2, name: '财务软件标准版', code: 'SP002', category: '软件', unit: '套', price: 1999, stock: 50, threshold: 10 },
          { id: 3, name: '代账服务年费', code: 'SP003', category: '服务', unit: '年', price: 3600, stock: 100, threshold: 20 },
          { id: 4, name: '税务咨询费', code: 'SP004', category: '服务', unit: '次', price: 500, stock: 200, threshold: 50 },
          { id: 5, name: '审计服务费', code: 'SP005', category: '服务', unit: '次', price: 3000, stock: 30, threshold: 10 }
        ];
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, data: demoProducts, isDemo: true }));
        return;
      }

      const products = usersDb.prepare('SELECT * FROM products WHERE user_id = ? ORDER BY id ASC').all(userId);
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

        // 企业注册：检查用户名是否已存在（企业用户以用户名为唯一标识）
        if (data.userType === 'enterprise') {
          const [existsRows] = await mysqlPool.execute('SELECT id FROM users WHERE username = ? AND user_type = ?', [username, 'enterprise']);
          if (existsRows.length > 0) {
            res.statusCode = 409;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: '该用户名已被使用，请更换用户名' }));
            return;
          }
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

  } else if (pathname === '/api/users/verify' && req.method === 'POST') {
    // 实名认证
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', async function() {
      try {
        const data = JSON.parse(body || '{}');
        const userId = data.user_id;
        const realName = data.real_name;
        const idType = data.id_type || 'idcard';
        const idNumber = data.id_number;

        if (!userId || !realName || !idNumber) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '参数不完整' }));
          return;
        }

        // 更新用户实名信息
        if (mysqlPool) {
          await mysqlPool.execute(
            'UPDATE users SET real_name = ?, id_type = ?, id_number = ?, is_verified = 1, update_time = NOW() WHERE id = ?',
            [realName, idType, idNumber, userId]
          );
        } else if (usersDb) {
          usersDb.prepare('UPDATE users SET real_name = ?, id_type = ?, id_number = ?, is_verified = 1, update_time = ? WHERE id = ?')
            .run(realName, idType, idNumber, new Date().toISOString(), userId);
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '实名认证提交成功' }));
      } catch (e) {
        console.error('实名认证失败:', e);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '认证失败: ' + e.message }));
      }
    });

  } else if (pathname === '/api/users/login' && req.method === 'POST') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', async function() {
      try {
        const data = JSON.parse(body || '{}');
        const account = (data.account || '').trim();
        const password = data.password || '';
        const userType = data.userType || 'personal';

        console.log('登录请求 - 账号:', account, '用户类型:', userType);

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

          console.log('MySQL查询:', query, params);
          const [rows] = await mysqlPool.execute(query, params);
          console.log('MySQL查询结果数量:', rows.length);
          if (rows.length > 0) {
            user = rows[0];
          }
        }

        // MySQL没有则从SQLite查询
        if (!user && usersDb) {
          console.log('从SQLite查询用户');
          if (userType === 'enterprise') {
            user = usersDb.prepare('SELECT * FROM users WHERE username = ? AND user_type = ?').get(account, 'enterprise');
          } else {
            user = usersDb.prepare('SELECT * FROM users WHERE phone = ? AND user_type = ?').get(account, userType);
          }
          console.log('SQLite查询结果:', user ? '找到用户' : '未找到用户');
        }

        // 用户不存在
        if (!user) {
          console.log('用户不存在:', account);
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '用户不存在，请先注册' }));
          return;
        }

        // 密码验证
        if (user.password !== password) {
          console.log('密码错误');
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '密码错误' }));
          return;
        }

        console.log('登录成功:', account);

        // 登录成功，返回用户信息（不包含密码）
        const userData = { ...user };
        delete userData.password;

        // 转换字段名为camelCase格式，兼容前端
        const responseData = {
          id: userData.id,
          username: userData.username,
          phone: userData.phone,
          userType: userData.user_type,
          institutionType: userData.institution_type,
          institutionName: userData.institution_name,
          enterpriseName: userData.enterprise_name,
          creditCode: userData.credit_code,
          contactPerson: userData.contact_person,
          industry: userData.industry,
          memberPoints: userData.member_points,
          memberExpiry: userData.member_expiry,
          creditScore: userData.credit_score,
          accountBalance: userData.account_balance,
          exclusiveServices: userData.exclusive_services,
          banStatus: userData.ban_status,
          banReason: userData.ban_reason,
          createTime: userData.create_time,
          updateTime: userData.update_time,
          isLoggedIn: true
        };

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: true,
          data: responseData
        }));
      } catch (e) {
        console.error('登录失败:', e);
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
    try {
      let accounts = [];
      let repairedDbFiles = 0;
      
      // 未登录用户返回演示账套
      if (!userId || userId === 'guest' || userId === 'demo') {
        if (mainDb) {
          accounts = mainDb.prepare("SELECT * FROM accounts WHERE status = 'active' AND (name LIKE '%演示%' OR name LIKE '%北京银河星辰%') ORDER BY create_time DESC").all();
        } else if (mysqlPool) {
          const [rows] = await mysqlPool.execute("SELECT * FROM accounts WHERE status = 'active' AND (name LIKE '%演示%' OR name LIKE '%北京银河星辰%') ORDER BY create_time DESC");
          accounts = rows;
        }
      } else {
        if (mainDb) {
          accounts = mainDb.prepare('SELECT * FROM accounts WHERE status = ? AND user_id = ? ORDER BY create_time DESC').all('active', userId);
        } else if (mysqlPool) {
          const [rows] = await mysqlPool.execute('SELECT * FROM accounts WHERE status = ? AND user_id = ? ORDER BY create_time DESC', ['active', userId]);
          accounts = rows;
        }
      }
      
      if (mainDb) {
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
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: accounts, repairedDbFiles: repairedDbFiles, isDemo: !userId || userId === 'guest' || userId === 'demo' }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '查询账套失败: ' + e.message }));
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
    req.on('end', function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.name || !data.userId) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '客户名称和用户ID为必填项' }));
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
          'INSERT INTO customers (name, contact, phone, address, user_id, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        const result = stmt.run(
          data.name,
          data.contact || '',
          data.phone || '',
          data.address || '',
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
    req.on('end', function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.id) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '客户ID为必填项' }));
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
        if (data.name !== undefined) { updateFields.push('name = ?'); updateValues.push(data.name); }
        if (data.contact !== undefined) { updateFields.push('contact = ?'); updateValues.push(data.contact); }
        if (data.phone !== undefined) { updateFields.push('phone = ?'); updateValues.push(data.phone); }
        if (data.address !== undefined) { updateFields.push('address = ?'); updateValues.push(data.address); }
        updateFields.push('update_time = ?');
        updateValues.push(new Date().toISOString());
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
    req.on('end', function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.id) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '客户ID为必填项' }));
          return;
        }
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

    // 使用阿里云MySQL作为主数据库
    if (!mysqlPool) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '数据库服务未启动' }));
      return;
    }

    try {
      console.log('获取送货单API调用');
      
      // 直接返回所有送货单
      const query = 'SELECT * FROM delivery_orders ORDER BY create_time DESC';
      const [orders] = await mysqlPool.execute(query, []);
      
      console.log('查询结果数量:', orders.length);

      const data = [];
      for (const order of orders) {
        const [items] = await mysqlPool.execute(
          'SELECT product_name, model, length, wattage, brightness, sensor_mode, quantity, unit, unit_price, amount FROM delivery_items WHERE delivery_id = ?',
          [order.id]
        );

        data.push({
          id: order.id,
          no: order.order_no,
          customer: order.customer_name,
          project: order.project_name || order.project || '',
          project_name: order.project_name || '',
          contact: order.contact_name || order.contact || '',
          contact_name: order.contact_name || '',
          contactPhone: order.customer_phone || '',
          address: order.customer_address,
          remark: order.remark || '',
          date: order.delivery_date.toISOString().split('T')[0],
          status: order.status === 'pending' ? '待送达' : '已送达',
          items: items.map(item => ({
            product: item.product_name,
            product_name: item.product_name,
            model: item.model || '',
            length: item.length || '',
            wattage: item.wattage || '',
            brightness: item.brightness || '',
            sensor: item.sensor_mode || '',
            sensorMode: item.sensor_mode || '',
            quantity: item.quantity,
            unit: item.unit || '个',
            price: item.unit_price,
            amount: item.amount
          })),
          createTime: order.create_time,
          updateTime: order.update_time
        });
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: data }));
    } catch (e) {
      console.error('MySQL获取送货单失败:', e.message);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '获取送货单失败: ' + e.message }));
    }
  // 添加送货单：POST /api/delivery-notes
  } else if (pathname === '/api/delivery-notes' && req.method === 'POST') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', async function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.no || !data.customer || !data.date || !data.userId) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '单号、客户、日期和用户ID为必填项' }));
          return;
        }

        if (!mysqlPool) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库服务未启动' }));
          return;
        }

        // 使用阿里云MySQL作为主数据库
        const insertOrderSql = `INSERT INTO delivery_orders (order_no, customer_name, customer_phone, customer_address, delivery_date, contact_name, project_name, total_amount, status, user_id, create_time, update_time, remark, contact, project) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const totalAmount = (data.items || []).reduce(function(sum, item) {
          return sum + (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 0);
        }, 0);

        const [orderResult] = await mysqlPool.execute(insertOrderSql, [
          data.no, data.customer, data.contactPhone || data.contact_phone || '', data.address || '',
          data.date, data.contact || '', data.project_name || data.project || '', totalAmount, data.status === '已送达' ? 'delivered' : 'pending',
          data.userId, new Date(), new Date(), data.remark || '', data.contact || '', data.project_name || data.project || ''
        ]);

        const deliveryId = orderResult.insertId;

        if (data.items && data.items.length > 0) {
          const itemSql = 'INSERT INTO delivery_items (delivery_id, product_name, model, length, wattage, brightness, sensor_mode, quantity, unit, unit_price, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
          for (const item of data.items) {
            const itemAmount = (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 0);
            await mysqlPool.execute(itemSql, [
              deliveryId, item.product || item.product_name || item.name || '', item.model || '', item.length || '',
              item.wattage || '', item.brightness || '', item.sensor || item.sensorMode || '',
              parseFloat(item.quantity) || 1, item.unit || '个', parseFloat(item.price) || 0, itemAmount
            ]);
          }
        }

        console.log(`[DeliveryNote] Created delivery note: ${data.no}`);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, data: { id: deliveryId, no: data.no } }));

      } catch (e) {
        console.error('添加送货单失败:', e.message);
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

        if (!mysqlPool) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库服务未启动' }));
          return;
        }

        const mysqlUpdateFields = [];
        const mysqlValues = [];
        if (data.no !== undefined) { mysqlUpdateFields.push('order_no = ?'); mysqlValues.push(data.no); }
        if (data.customer !== undefined) { mysqlUpdateFields.push('customer_name = ?'); mysqlValues.push(data.customer); }
        if (data.contactPhone !== undefined) { mysqlUpdateFields.push('customer_phone = ?'); mysqlValues.push(data.contactPhone); }
        if (data.address !== undefined) { mysqlUpdateFields.push('customer_address = ?'); mysqlValues.push(data.address); }
        if (data.date !== undefined) { mysqlUpdateFields.push('delivery_date = ?'); mysqlValues.push(data.date); }
        if (data.project_name !== undefined || data.project !== undefined) { mysqlUpdateFields.push('project_name = ?'); mysqlValues.push(data.project_name || data.project || ''); }
        if (data.project !== undefined) { mysqlUpdateFields.push('project = ?'); mysqlValues.push(data.project); }
        if (data.contact !== undefined) { mysqlUpdateFields.push('contact_name = ?'); mysqlValues.push(data.contact); }
        if (data.contact !== undefined) { mysqlUpdateFields.push('contact = ?'); mysqlValues.push(data.contact); }
        if (data.status !== undefined) { mysqlUpdateFields.push('status = ?'); mysqlValues.push(data.status === '已送达' ? 'delivered' : 'pending'); }
        if (data.remark !== undefined) { mysqlUpdateFields.push('remark = ?'); mysqlValues.push(data.remark); }
        if (data.items !== undefined) {
          const totalAmount = (data.items || []).reduce(function(sum, item) { return sum + (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 0); }, 0);
          mysqlUpdateFields.push('total_amount = ?');
          mysqlValues.push(totalAmount);
        }
        mysqlUpdateFields.push('update_time = ?');
        mysqlValues.push(new Date());
        mysqlValues.push(data.id);

        await mysqlPool.execute('UPDATE delivery_orders SET ' + mysqlUpdateFields.join(', ') + ' WHERE id = ?', mysqlValues);

        if (data.items !== undefined) {
          await mysqlPool.execute('DELETE FROM delivery_items WHERE delivery_id = ?', [data.id]);

          if (data.items && data.items.length > 0) {
            const itemSql = 'INSERT INTO delivery_items (delivery_id, product_name, model, length, wattage, brightness, sensor_mode, quantity, unit, unit_price, amount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
            for (const item of data.items) {
              const itemAmount = (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 0);
              await mysqlPool.execute(itemSql, [
                data.id, item.product || item.product_name || item.name || '', item.model || '', item.length || '',
                item.wattage || '', item.brightness || '', item.sensor || item.sensorMode || '',
                parseFloat(item.quantity) || 1, item.unit || '个', parseFloat(item.price) || 0, itemAmount
              ]);
            }
          }
        }

        console.log(`[DeliveryNote] Updated delivery note: ID=${data.id}`);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '送货单更新成功' }));

      } catch (e) {
        console.error('更新送货单失败:', e.message);
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

        if (!mysqlPool) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库服务未启动' }));
          return;
        }

        await mysqlPool.execute('DELETE FROM delivery_items WHERE delivery_id = ?', [data.id]);
        await mysqlPool.execute('DELETE FROM delivery_orders WHERE id = ?', [data.id]);

        console.log(`[DeliveryNote] Deleted delivery note: ID=${data.id}`);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '送货单删除成功' }));

      } catch (e) {
        console.error('删除送货单失败:', e.message);
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

  // ==================== 营销活动API ====================
  } else if (pathname === '/api/admin/coupons' && req.method === 'GET') {
    // 获取优惠券列表
    try {
      let coupons = [];
      if (mysqlPool) {
        const conn = await mysqlPool.getConnection();
        await conn.execute(`
          CREATE TABLE IF NOT EXISTS coupons (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(100) NOT NULL,
            type VARCHAR(20) NOT NULL,
            amount DECIMAL(10,2) DEFAULT 0,
            discount DECIMAL(3,2) DEFAULT 1.00,
            min_amount DECIMAL(10,2) DEFAULT 0,
            start_date DATE,
            end_date DATE,
            total_count INT DEFAULT 0,
            used_count INT DEFAULT 0,
            status VARCHAR(20) DEFAULT 'active',
            create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_status (status)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        const [rows] = await conn.execute('SELECT * FROM coupons ORDER BY create_time DESC');
        coupons = rows;
        conn.release();
      } else if (usersDb) {
        usersDb.exec(`
          CREATE TABLE IF NOT EXISTS coupons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            amount REAL DEFAULT 0,
            discount REAL DEFAULT 1,
            min_amount REAL DEFAULT 0,
            start_date TEXT,
            end_date TEXT,
            total_count INTEGER DEFAULT 0,
            used_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'active',
            create_time TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);
        coupons = usersDb.prepare('SELECT * FROM coupons ORDER BY id DESC').all();
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: coupons }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '获取优惠券失败: ' + e.message }));
    }

  } else if (pathname === '/api/admin/coupons' && req.method === 'POST') {
    // 创建优惠券
    let body = '';
    req.on('data', chunk => body += chunk.toString('utf8'));
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        if (mysqlPool) {
          const conn = await mysqlPool.getConnection();
          await conn.execute(`
            INSERT INTO coupons (name, type, amount, discount, min_amount, start_date, end_date, total_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [data.name, data.type, data.amount || 0, data.discount || 1, data.min_amount || 0, data.start_date, data.end_date, data.total_count || 0]);
          conn.release();
        } else if (usersDb) {
          usersDb.exec(`
            CREATE TABLE IF NOT EXISTS coupons (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              type TEXT NOT NULL,
              amount REAL DEFAULT 0,
              discount REAL DEFAULT 1,
              min_amount REAL DEFAULT 0,
              start_date TEXT,
              end_date TEXT,
              total_count INTEGER DEFAULT 0,
              used_count INTEGER DEFAULT 0,
              status TEXT DEFAULT 'active',
              create_time TEXT DEFAULT CURRENT_TIMESTAMP
            )
          `);
          usersDb.prepare(`INSERT INTO coupons (name, type, amount, discount, min_amount, start_date, end_date, total_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(data.name, data.type, data.amount || 0, data.discount || 1, data.min_amount || 0, data.start_date, data.end_date, data.total_count || 0);
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '优惠券创建成功' }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '创建优惠券失败: ' + e.message }));
      }
    });

  } else if (pathname.startsWith('/api/admin/coupons/') && req.method === 'DELETE') {
    // 删除优惠券
    const couponId = pathname.split('/')[4];
    try {
      if (mysqlPool) {
        const conn = await mysqlPool.getConnection();
        await conn.execute('DELETE FROM coupons WHERE id = ?', [couponId]);
        conn.release();
      } else if (usersDb) {
        usersDb.prepare('DELETE FROM coupons WHERE id = ?').run(couponId);
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, message: '优惠券已删除' }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '删除失败: ' + e.message }));
    }

  } else if (pathname === '/api/admin/activities' && req.method === 'GET') {
    // 获取营销活动列表
    try {
      let activities = [];
      if (mysqlPool) {
        const conn = await mysqlPool.getConnection();
        await conn.execute(`
          CREATE TABLE IF NOT EXISTS marketing_activities (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(100) NOT NULL,
            type VARCHAR(20) NOT NULL,
            description TEXT,
            start_time DATETIME,
            end_time DATETIME,
            participants INT DEFAULT 0,
            status VARCHAR(20) DEFAULT 'pending',
            create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_status (status)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        const [rows] = await conn.execute('SELECT * FROM marketing_activities ORDER BY create_time DESC');
        activities = rows;
        conn.release();
      } else if (usersDb) {
        usersDb.exec(`
          CREATE TABLE IF NOT EXISTS marketing_activities (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            description TEXT,
            start_time TEXT,
            end_time TEXT,
            participants INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            create_time TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);
        activities = usersDb.prepare('SELECT * FROM marketing_activities ORDER BY id DESC').all();
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: activities }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '获取活动失败: ' + e.message }));
    }

  } else if (pathname === '/api/admin/activities' && req.method === 'POST') {
    // 创建营销活动
    let body = '';
    req.on('data', chunk => body += chunk.toString('utf8'));
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        if (mysqlPool) {
          const conn = await mysqlPool.getConnection();
          await conn.execute(`
            INSERT INTO marketing_activities (name, type, description, start_time, end_time)
            VALUES (?, ?, ?, ?, ?)
          `, [data.name, data.type, data.description || '', data.start_time, data.end_time]);
          conn.release();
        } else if (usersDb) {
          usersDb.exec(`
            CREATE TABLE IF NOT EXISTS marketing_activities (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              type TEXT NOT NULL,
              description TEXT,
              start_time TEXT,
              end_time TEXT,
              participants INTEGER DEFAULT 0,
              status TEXT DEFAULT 'pending',
              create_time TEXT DEFAULT CURRENT_TIMESTAMP
            )
          `);
          usersDb.prepare(`INSERT INTO marketing_activities (name, type, description, start_time, end_time) VALUES (?, ?, ?, ?, ?)`)
            .run(data.name, data.type, data.description || '', data.start_time, data.end_time);
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '活动创建成功' }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '创建活动失败: ' + e.message }));
      }
    });

  } else if (pathname.startsWith('/api/admin/activities/') && req.method === 'DELETE') {
    // 删除营销活动
    const activityId = pathname.split('/')[4];
    try {
      if (mysqlPool) {
        const conn = await mysqlPool.getConnection();
        await conn.execute('DELETE FROM marketing_activities WHERE id = ?', [activityId]);
        conn.release();
      } else if (usersDb) {
        usersDb.prepare('DELETE FROM marketing_activities WHERE id = ?').run(activityId);
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, message: '活动已删除' }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '删除失败: ' + e.message }));
    }

  // ==================== 访问监控API ====================
  } else if (pathname === '/api/admin/monitor' && req.method === 'GET') {
    // 获取访问日志
    try {
      const range = parsedUrl.query.range || 'today';
      let logs = [];
      let uniqueVisitors = 0;

      if (mysqlPool) {
        const conn = await mysqlPool.getConnection();
        // 确保表存在
        await conn.execute(`
          CREATE TABLE IF NOT EXISTS visit_logs (
            id INT PRIMARY KEY AUTO_INCREMENT,
            ip VARCHAR(50) NOT NULL,
            city VARCHAR(50),
            user_agent TEXT,
            page VARCHAR(255) NOT NULL,
            user_id VARCHAR(64),
            username VARCHAR(100),
            phone VARCHAR(20),
            visit_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            referer TEXT,
            params TEXT,
            INDEX idx_visit_time (visit_time),
            INDEX idx_ip (ip)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        // 根据时间范围查询
        let whereClause = '1=1';
        if (range === 'today') {
          whereClause = "DATE(visit_time) = CURDATE()";
        } else if (range === 'week') {
          whereClause = "visit_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
        } else if (range === 'month') {
          whereClause = "visit_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
        }

        const [rows] = await conn.execute(`
          SELECT * FROM visit_logs
          WHERE ${whereClause}
          ORDER BY visit_time DESC
          LIMIT 500
        `);
        logs = rows;

        // 统计独立访客
        const [uniqueRows] = await conn.execute(`
          SELECT COUNT(DISTINCT ip) as count FROM visit_logs WHERE ${whereClause}
        `);
        uniqueVisitors = uniqueRows[0]?.count || 0;
        conn.release();

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: true,
          data: {
            logs: logs,
            total: logs.length,
            uniqueVisitors: uniqueVisitors
          }
        }));
      } else if (usersDb) {
        // 确保表存在
        usersDb.exec(`
          CREATE TABLE IF NOT EXISTS visit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip TEXT NOT NULL,
            city TEXT,
            user_agent TEXT,
            page TEXT NOT NULL,
            user_id TEXT,
            username TEXT,
            phone TEXT,
            visit_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            referer TEXT,
            params TEXT
          )
        `);

        // 根据时间范围查询
        let whereClause = '1=1';
        if (range === 'today') {
          whereClause = "date(visit_time) = date('now', 'localtime')";
        } else if (range === 'week') {
          whereClause = "visit_time >= datetime('now', '-7 days', 'localtime')";
        } else if (range === 'month') {
          whereClause = "visit_time >= datetime('now', '-30 days', 'localtime')";
        }

        logs = usersDb.prepare(`
          SELECT * FROM visit_logs
          WHERE ${whereClause}
          ORDER BY visit_time DESC
          LIMIT 500
        `).all();

        // 统计独立访客
        const uniqueResult = usersDb.prepare(`
          SELECT COUNT(DISTINCT ip) as count FROM visit_logs WHERE ${whereClause}
        `).get();
        uniqueVisitors = uniqueResult?.count || 0;

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: true,
          data: {
            logs: logs,
            total: logs.length,
            uniqueVisitors: uniqueVisitors?.count || 0
          }
        }));
      } else {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, data: { logs: [], total: 0, uniqueVisitors: 0 } }));
      }
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '获取访问日志失败: ' + e.message }));
    }

  } else if (pathname === '/api/admin/monitor/user' && req.method === 'GET') {
    // 获取用户活动详情
    try {
      const identifier = parsedUrl.query.identifier || '';

      if (!usersDb) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, data: { user: {}, activities: [], posts: [] } }));
        return;
      }

      // 确保表存在
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS visit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ip TEXT NOT NULL,
          city TEXT,
          user_agent TEXT,
          page TEXT NOT NULL,
          user_id TEXT,
          username TEXT,
          phone TEXT,
          visit_time DATETIME DEFAULT CURRENT_TIMESTAMP,
          referer TEXT,
          params TEXT
        )
      `);

      // 查找用户活动
      let activities = [];
      let user = {};

      // 尝试按用户ID、手机号或IP查找
      activities = usersDb.prepare(`
        SELECT * FROM visit_logs
        WHERE user_id = ? OR phone = ? OR username = ? OR ip = ?
        ORDER BY visit_time DESC
        LIMIT 100
      `).all(identifier, identifier, identifier, identifier);

      if (activities.length > 0) {
        user = {
          ip: activities[0].ip,
          city: activities[0].city,
          username: activities[0].username,
          phone: activities[0].phone,
          visit_count: activities.length,
          last_visit: activities[0].visit_time
        };
      }

      // 查找用户发布的内容（论坛帖子、评论等）
      let posts = [];
      try {
        posts = usersDb.prepare(`
          SELECT
            '论坛帖子' as type,
            title,
            content,
            create_time as time
          FROM forum_posts
          WHERE author_id = ? OR author_name = ?
          ORDER BY create_time DESC
          LIMIT 20
        `).all(identifier, identifier);
      } catch (e) {
        // 表可能不存在
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        success: true,
        data: {
          user: user,
          activities: activities,
          posts: posts
        }
      }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '获取用户活动失败: ' + e.message }));
    }

  } else if (pathname === '/api/track' && req.method === 'POST') {
    // 记录访问日志（前端调用）
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', async function() {
      try {
        const data = JSON.parse(body || '{}');
        let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
        ip = ip.replace('::ffff:', '').split(',')[0].trim();
        const userAgent = req.headers['user-agent'] || '';
        const referer = req.headers['referer'] || '';

        // 通过IP获取城市
        let city = data.city || '';

        // 使用免费IP地理位置API获取城市
        async function getCityByIPAPI(ip) {
          if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
            return '本地网络';
          }

          // 检查缓存
          if (!global.ipCityCache) global.ipCityCache = new Map();
          const cached = global.ipCityCache.get(ip);
          if (cached && Date.now() - cached.time < 3600000) { // 1小时缓存
            return cached.city;
          }

          try {
            // 使用 ip-api.com 免费API（无需API key，每分钟45次请求限制）
            const httpModule = require('http');
            return new Promise((resolve) => {
              const req = httpModule.get(`http://ip-api.com/json/${ip}?lang=zh-CN&fields=status,country,regionName,city`, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                  try {
                    const result = JSON.parse(data);
                    if (result.status === 'success') {
                      const cityStr = result.city || result.regionName || result.country || '未知';
                      global.ipCityCache.set(ip, { city: cityStr, time: Date.now() });
                      resolve(cityStr);
                    } else {
                      resolve(getCityByIPRange(ip));
                    }
                  } catch (e) {
                    resolve(getCityByIPRange(ip));
                  }
                });
              });
              req.on('error', () => resolve(getCityByIPRange(ip)));
              req.setTimeout(2000, () => { req.destroy(); resolve(getCityByIPRange(ip)); });
            });
          } catch (e) {
            return getCityByIPRange(ip);
          }
        }

        // IP范围映射（备用方案）
        function getCityByIPRange(ip) {
          if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
            return '本地网络';
          }
          const parts = ip.split('.');
          if (parts.length !== 4) return '未知';
          const first = parseInt(parts[0], 10);
          const second = parseInt(parts[1], 10);
          // 常见IP段对应城市（更准确的映射）
          const ipRanges = [
            // 北京
            { min: [1, 0], max: [1, 255], city: '北京' },
            { min: [14, 0], max: [14, 255], city: '北京' },
            { min: [27, 0], max: [27, 255], city: '北京' },
            { min: [42, 0], max: [42, 255], city: '北京' },
            { min: [49, 0], max: [49, 255], city: '北京' },
            { min: [58, 0], max: [58, 255], city: '北京' },
            { min: [59, 0], max: [59, 255], city: '北京' },
            { min: [60, 0], max: [60, 255], city: '北京' },
            { min: [61, 0], max: [61, 255], city: '北京' },
            { min: [106, 0], max: [106, 255], city: '北京' },
            { min: [110, 0], max: [110, 255], city: '北京' },
            { min: [111, 0], max: [111, 255], city: '北京' },
            { min: [112, 0], max: [112, 255], city: '北京' },
            { min: [113, 0], max: [113, 255], city: '北京' },
            { min: [114, 0], max: [114, 255], city: '北京' },
            { min: [115, 0], max: [115, 255], city: '北京' },
            { min: [116, 0], max: [116, 150], city: '北京' },
            { min: [117, 0], max: [117, 255], city: '北京' },
            { min: [118, 0], max: [118, 255], city: '北京' },
            { min: [119, 0], max: [119, 255], city: '北京' },
            { min: [120, 0], max: [120, 255], city: '北京' },
            { min: [121, 0], max: [121, 255], city: '北京' },
            { min: [122, 0], max: [122, 255], city: '北京' },
            { min: [123, 0], max: [123, 255], city: '北京' },
            { min: [124, 0], max: [124, 255], city: '北京' },
            { min: [125, 0], max: [125, 255], city: '北京' },
            { min: [202, 0], max: [202, 255], city: '北京' },
            { min: [203, 0], max: [203, 255], city: '北京' },
            { min: [210, 0], max: [210, 255], city: '北京' },
            { min: [211, 0], max: [211, 255], city: '北京' },
            { min: [218, 0], max: [218, 255], city: '北京' },
            { min: [219, 0], max: [219, 255], city: '北京' },
            { min: [220, 0], max: [220, 150], city: '北京' },
            { min: [221, 0], max: [221, 255], city: '北京' },
            { min: [222, 0], max: [222, 255], city: '北京' },
            { min: [223, 0], max: [223, 255], city: '北京' },
            // 上海
            { min: [58, 0], max: [58, 255], city: '上海' },
            { min: [61, 128], max: [61, 191], city: '上海' },
            { min: [101, 0], max: [101, 255], city: '上海' },
            { min: [116, 224], max: [116, 255], city: '上海' },
            { min: [180, 0], max: [180, 255], city: '上海' },
            { min: [202, 96], max: [202, 127], city: '上海' },
            // 广州/广东
            { min: [14, 0], max: [14, 255], city: '广州' },
            { min: [27, 0], max: [27, 255], city: '广州' },
            { min: [42, 0], max: [42, 255], city: '广州' },
            { min: [59, 0], max: [59, 255], city: '广州' },
            { min: [61, 0], max: [61, 127], city: '广州' },
            { min: [113, 64], max: [113, 127], city: '广州' },
            { min: [119, 0], max: [119, 255], city: '广州' },
            { min: [120, 0], max: [120, 255], city: '广州' },
            { min: [121, 0], max: [121, 255], city: '广州' },
            { min: [183, 0], max: [183, 255], city: '广州' },
            // 深圳
            { min: [113, 128], max: [113, 191], city: '深圳' },
            // 杭州/浙江
            { min: [60, 0], max: [60, 255], city: '杭州' },
            { min: [115, 192], max: [115, 223], city: '杭州' },
            { min: [122, 0], max: [122, 255], city: '杭州' },
            // 南京/江苏
            { min: [49, 0], max: [49, 255], city: '南京' },
            { min: [58, 192], max: [58, 223], city: '南京' },
            { min: [114, 224], max: [114, 255], city: '南京' },
            // 成都/四川
            { min: [118, 112], max: [118, 127], city: '成都' },
            { min: [171, 0], max: [171, 255], city: '成都' },
            { min: [182, 0], max: [182, 255], city: '成都' },
            // 武汉/湖北
            { min: [58, 48], max: [58, 63], city: '武汉' },
            { min: [111, 0], max: [111, 255], city: '武汉' },
            { min: [119, 96], max: [119, 127], city: '武汉' },
            // 长沙/湖南
            { min: [58, 20], max: [58, 39], city: '长沙' },
            { min: [110, 0], max: [110, 255], city: '长沙' },
            { min: [218, 76], max: [218, 79], city: '长沙' },
            // 西安/陕西
            { min: [61, 134], max: [61, 135], city: '西安' },
            { min: [113, 192], max: [113, 207], city: '西安' },
            { min: [124, 89], max: [124, 95], city: '西安' },
            // 郑州/河南
            { min: [61, 52], max: [61, 53], city: '郑州' },
            { min: [61, 158], max: [61, 159], city: '郑州' },
            { min: [125, 40], max: [125, 47], city: '郑州' },
            // 天津
            { min: [60, 24], max: [60, 31], city: '天津' },
            { min: [117, 0], max: [117, 255], city: '天津' },
            { min: [221, 196], max: [221, 199], city: '天津' },
            // 重庆
            { min: [61, 128], max: [61, 191], city: '重庆' },
            { min: [118, 112], max: [118, 127], city: '重庆' },
            { min: [222, 180], max: [222, 183], city: '重庆' },
            // 沈阳/辽宁
            { min: [59, 44], max: [59, 47], city: '沈阳' },
            { min: [60, 0], max: [60, 15], city: '沈阳' },
            { min: [61, 176], max: [61, 179], city: '沈阳' },
            { min: [113, 224], max: [113, 239], city: '沈阳' },
            // 哈尔滨/黑龙江
            { min: [61, 138], max: [61, 139], city: '哈尔滨' },
            { min: [113, 0], max: [113, 15], city: '哈尔滨' },
            { min: [125, 208], max: [125, 223], city: '哈尔滨' },
            // 济南/山东
            { min: [60, 208], max: [60, 223], city: '济南' },
            { min: [119, 176], max: [119, 191], city: '济南' },
            { min: [123, 232], max: [123, 239], city: '济南' },
            // 青岛/山东
            { min: [119, 0], max: [119, 15], city: '青岛' },
            { min: [221, 0], max: [221, 15], city: '青岛' },
            // 福州/福建
            { min: [59, 56], max: [59, 63], city: '福州' },
            { min: [120, 32], max: [120, 39], city: '福州' },
            { min: [218, 0], max: [218, 15], city: '福州' },
            // 厦门/福建
            { min: [59, 60], max: [59, 63], city: '厦门' },
            { min: [121, 204], max: [121, 207], city: '厦门' },
            // 昆明/云南
            { min: [61, 159], max: [61, 159], city: '昆明' },
            { min: [116, 52], max: [116, 55], city: '昆明' },
            { min: [222, 212], max: [222, 215], city: '昆明' },
            // 贵阳/贵州
            { min: [61, 189], max: [61, 189], city: '贵阳' },
            { min: [222, 84], max: [222, 87], city: '贵阳' },
            // 南宁/广西
            { min: [61, 235], max: [61, 235], city: '南宁' },
            { min: [116, 252], max: [116, 255], city: '南宁' },
            { min: [222, 216], max: [222, 219], city: '南宁' },
            // 海口/海南
            { min: [59, 50], max: [59, 51], city: '海口' },
            { min: [124, 225], max: [124, 231], city: '海口' },
            // 石家庄/河北
            { min: [60, 4], max: [60, 7], city: '石家庄' },
            { min: [61, 182], max: [61, 183], city: '石家庄' },
            { min: [124, 128], max: [124, 135], city: '石家庄' },
            // 合肥/安徽
            { min: [60, 166], max: [60, 167], city: '合肥' },
            { min: [61, 190], max: [61, 191], city: '合肥' },
            { min: [124, 72], max: [124, 75], city: '合肥' },
            // 南昌/江西
            { min: [59, 52], max: [59, 55], city: '南昌' },
            { min: [61, 180], max: [61, 180], city: '南昌' },
            { min: [218, 64], max: [218, 67], city: '南昌' },
            // 太原/山西
            { min: [60, 220], max: [60, 223], city: '太原' },
            { min: [61, 134], max: [61, 135], city: '太原' },
            { min: [124, 164], max: [124, 167], city: '太原' },
            // 呼和浩特/内蒙古
            { min: [61, 134], max: [61, 135], city: '呼和浩特' },
            { min: [124, 67], max: [124, 67], city: '呼和浩特' },
            { min: [222, 74], max: [222, 75], city: '呼和浩特' },
            // 兰州/甘肃
            { min: [61, 178], max: [61, 179], city: '兰州' },
            { min: [124, 88], max: [124, 89], city: '兰州' },
            { min: [222, 240], max: [222, 243], city: '兰州' },
            // 银川/宁夏
            { min: [61, 133], max: [61, 133], city: '银川' },
            { min: [124, 68], max: [124, 68], city: '银川' },
            { min: [222, 240], max: [222, 240], city: '银川' },
            // 西宁/青海
            { min: [61, 133], max: [61, 133], city: '西宁' },
            { min: [124, 152], max: [124, 152], city: '西宁' },
            { min: [222, 240], max: [222, 240], city: '西宁' },
            // 乌鲁木齐/新疆
            { min: [61, 132], max: [61, 133], city: '乌鲁木齐' },
            { min: [124, 112], max: [124, 127], city: '乌鲁木齐' },
            { min: [222, 80], max: [222, 83], city: '乌鲁木齐' },
            // 拉萨/西藏
            { min: [61, 188], max: [61, 188], city: '拉萨' },
            { min: [219, 151], max: [219, 151], city: '拉萨' },
          ];
          for (const range of ipRanges) {
            if ((first > range.min[0] || (first === range.min[0] && second >= range.min[1])) &&
                (first < range.max[0] || (first === range.max[0] && second <= range.max[1]))) {
              return range.city;
            }
          }
          // 根据第一个IP段大致判断
          if (first >= 1 && first <= 50) return '海外';
          if (first >= 51 && first <= 80) return '海外';
          if (first >= 81 && first <= 126) return '中国';
          if (first >= 128 && first <= 191) return '中国';
          if (first >= 192 && first <= 223) return '中国';
          return '未知';
        }

        // 尝试通过API获取城市
        if (!city && ip && ip !== '127.0.0.1' && ip !== '::1' && !ip.startsWith('192.168.') && !ip.startsWith('10.') && !ip.startsWith('172.')) {
          try {
            city = await getCityByIPAPI(ip);
          } catch (e) {
            city = getCityByIPRange(ip);
          }
        }

        if (mysqlPool) {
          const conn = await mysqlPool.getConnection();
          // 确保表存在
          await conn.execute(`
            CREATE TABLE IF NOT EXISTS visit_logs (
              id INT PRIMARY KEY AUTO_INCREMENT,
              ip VARCHAR(50) NOT NULL,
              city VARCHAR(50),
              user_agent TEXT,
              page VARCHAR(255) NOT NULL,
              user_id VARCHAR(64),
              username VARCHAR(100),
              phone VARCHAR(20),
              visit_time DATETIME DEFAULT CURRENT_TIMESTAMP,
              referer TEXT,
              params TEXT,
              INDEX idx_visit_time (visit_time),
              INDEX idx_ip (ip)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
          `);

          await conn.execute(`
            INSERT INTO visit_logs (ip, city, user_agent, page, user_id, username, phone, referer, params)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            ip,
            city,
            userAgent.substring(0, 500),
            data.page || '',
            data.userId || '',
            data.username || '',
            data.phone || '',
            referer,
            JSON.stringify(data.params || {})
          ]);
          conn.release();
        } else if (usersDb) {
          // 确保表存在
          usersDb.exec(`
            CREATE TABLE IF NOT EXISTS visit_logs (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              ip TEXT NOT NULL,
              city TEXT,
              user_agent TEXT,
              page TEXT NOT NULL,
              user_id TEXT,
              username TEXT,
              phone TEXT,
              visit_time DATETIME DEFAULT CURRENT_TIMESTAMP,
              referer TEXT,
              params TEXT
            )
          `);

          usersDb.prepare(`
            INSERT INTO visit_logs (ip, city, user_agent, page, user_id, username, phone, referer, params)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            ip,
            city,
            userAgent.substring(0, 500),
            data.page || '',
            data.userId || '',
            data.username || '',
            data.phone || '',
            referer,
            JSON.stringify(data.params || {})
          );
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, city: city }));
      } catch (e) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });

  // ==================== 发票管理 API ====================

  } else if (pathname === '/api/invoices' && req.method === 'GET') {
    // 获取发票列表
    try {
      const page = parseInt(parsedUrl.query.page || '1');
      const pageSize = parseInt(parsedUrl.query.pageSize || '20');
      const offset = (page - 1) * pageSize;
      const status = parsedUrl.query.status || '';
      const userId = parsedUrl.query.userId || '';

      let invoices = [];
      let total = 0;

      if (mysqlPool) {
        const conn = await mysqlPool.getConnection();
        try {
          // 确保表存在
          await conn.execute(`
            CREATE TABLE IF NOT EXISTS invoices (
              id INT AUTO_INCREMENT PRIMARY KEY,
              invoice_no VARCHAR(50) NOT NULL,
              customer_name VARCHAR(200) NOT NULL,
              amount DECIMAL(12,2) NOT NULL,
              tax_rate DECIMAL(5,2) DEFAULT 0.13,
              tax_amount DECIMAL(12,2) DEFAULT 0,
              total_amount DECIMAL(12,2) DEFAULT 0,
              invoice_date DATE NOT NULL,
              due_date DATE,
              status VARCHAR(20) DEFAULT 'pending',
              invoice_type VARCHAR(20) DEFAULT 'sales',
              description TEXT,
              user_id VARCHAR(64),
              create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
              update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              INDEX idx_status (status),
              INDEX idx_user_id (user_id),
              INDEX idx_invoice_date (invoice_date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);

          let whereClause = '1=1';
          const params = [];
          if (status) {
            whereClause += ' AND status = ?';
            params.push(status);
          }
          if (userId) {
            whereClause += ' AND user_id = ?';
            params.push(userId);
          }

          const [countRows] = await conn.execute(
            `SELECT COUNT(*) as total FROM invoices WHERE ${whereClause}`,
            params
          );
          total = countRows[0].total;

          const [rows] = await conn.execute(
            `SELECT * FROM invoices WHERE ${whereClause} ORDER BY invoice_date DESC, create_time DESC LIMIT ? OFFSET ?`,
            [...params, pageSize, offset]
          );
          invoices = rows;
        } finally {
          conn.release();
        }
      } else if (usersDb) {
        usersDb.exec(`
          CREATE TABLE IF NOT EXISTS invoices (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            invoice_no TEXT NOT NULL,
            customer_name TEXT NOT NULL,
            amount REAL NOT NULL,
            tax_rate REAL DEFAULT 0.13,
            tax_amount REAL DEFAULT 0,
            total_amount REAL DEFAULT 0,
            invoice_date TEXT NOT NULL,
            due_date TEXT,
            status TEXT DEFAULT 'pending',
            invoice_type TEXT DEFAULT 'sales',
            description TEXT,
            user_id TEXT,
            create_time TEXT NOT NULL,
            update_time TEXT
          )
        `);

        let whereClause = '1=1';
        const params = [];
        if (status) {
          whereClause += ' AND status = ?';
          params.push(status);
        }
        if (userId) {
          whereClause += ' AND user_id = ?';
          params.push(userId);
        }

        const countRow = usersDb.prepare(`SELECT COUNT(*) as total FROM invoices WHERE ${whereClause}`).get(...params);
        total = countRow?.total || 0;

        invoices = usersDb.prepare(`
          SELECT * FROM invoices WHERE ${whereClause} ORDER BY invoice_date DESC, create_time DESC LIMIT ? OFFSET ?
        `).all(...params, pageSize, offset);
      }

      // 如果没有数据，返回演示数据
      if (invoices.length === 0) {
        invoices = getDemoInvoices();
        total = invoices.length;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        success: true,
        data: {
          invoices: invoices,
          total: total,
          page: page,
          pageSize: pageSize
        }
      }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '获取发票列表失败: ' + e.message }));
    }

  } else if (pathname === '/api/invoices' && req.method === 'POST') {
    // 添加发票
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', async function() {
      try {
        const data = JSON.parse(body || '{}');

        if (!data.invoiceNo || !data.customerName || !data.amount) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '缺少必填字段' }));
          return;
        }

        const invoiceNo = data.invoiceNo || 'INV-' + Date.now();
        const customerName = data.customerName;
        const amount = parseFloat(data.amount) || 0;
        const taxRate = parseFloat(data.taxRate) || 0.13;
        const taxAmount = amount * taxRate;
        const totalAmount = amount + taxAmount;
        const invoiceDate = data.invoiceDate || new Date().toISOString().slice(0, 10);
        const dueDate = data.dueDate || '';
        const status = data.status || 'pending';
        const invoiceType = data.invoiceType || 'sales';
        const description = data.description || '';
        const userId = data.userId || '';

        if (mysqlPool) {
          const conn = await mysqlPool.getConnection();
          try {
            await conn.execute(`
              INSERT INTO invoices (invoice_no, customer_name, amount, tax_rate, tax_amount, total_amount, invoice_date, due_date, status, invoice_type, description, user_id)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [invoiceNo, customerName, amount, taxRate, taxAmount, totalAmount, invoiceDate, dueDate, status, invoiceType, description, userId]);
          } finally {
            conn.release();
          }
        } else if (usersDb) {
          usersDb.exec(`
            CREATE TABLE IF NOT EXISTS invoices (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              invoice_no TEXT NOT NULL,
              customer_name TEXT NOT NULL,
              amount REAL NOT NULL,
              tax_rate REAL DEFAULT 0.13,
              tax_amount REAL DEFAULT 0,
              total_amount REAL DEFAULT 0,
              invoice_date TEXT NOT NULL,
              due_date TEXT,
              status TEXT DEFAULT 'pending',
              invoice_type TEXT DEFAULT 'sales',
              description TEXT,
              user_id TEXT,
              create_time TEXT NOT NULL,
              update_time TEXT
            )
          `);

          usersDb.prepare(`
            INSERT INTO invoices (invoice_no, customer_name, amount, tax_rate, tax_amount, total_amount, invoice_date, due_date, status, invoice_type, description, user_id, create_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(invoiceNo, customerName, amount, taxRate, taxAmount, totalAmount, invoiceDate, dueDate, status, invoiceType, description, userId, new Date().toISOString());
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '发票添加成功' }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '添加发票失败: ' + e.message }));
      }
    });

  // ==================== 新闻头条 API ====================

  } else if (pathname === '/api/news' && req.method === 'GET') {
    // 获取新闻列表
    try {
      const category = parsedUrl.query.category || '';
      const page = parseInt(parsedUrl.query.page || '1');
      const pageSize = parseInt(parsedUrl.query.pageSize || '20');
      const offset = (page - 1) * pageSize;

      let news = [];
      let total = 0;

      if (mysqlPool) {
        // 使用MySQL
        const conn = await mysqlPool.getConnection();
        try {
          // 确保表存在
          await conn.execute(`
            CREATE TABLE IF NOT EXISTS news_articles (
              id INT AUTO_INCREMENT PRIMARY KEY,
              title VARCHAR(500) NOT NULL,
              source VARCHAR(100) NOT NULL,
              category VARCHAR(50) NOT NULL,
              content TEXT NOT NULL,
              summary TEXT,
              author VARCHAR(100),
              publish_time DATETIME,
              view_count INT DEFAULT 0,
              like_count INT DEFAULT 0,
              source_url VARCHAR(500),
              status VARCHAR(20) DEFAULT 'published',
              create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
              update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              INDEX idx_category (category),
              INDEX idx_status (status),
              INDEX idx_publish_time (publish_time)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);

          let whereClause = "status = 'published'";
          const params = [];
          if (category && category !== '全部') {
            whereClause += " AND category = ?";
            params.push(category);
          }

          // 获取总数
          const [countRows] = await conn.execute(
            `SELECT COUNT(*) as total FROM news_articles WHERE ${whereClause}`,
            params
          );
          total = countRows[0].total;

          // 获取数据
          const [rows] = await conn.execute(
            `SELECT * FROM news_articles WHERE ${whereClause} ORDER BY publish_time DESC, create_time DESC LIMIT ? OFFSET ?`,
            [...params, pageSize, offset]
          );
          news = rows.map(row => ({
            id: row.id,
            title: row.title,
            source: row.source,
            category: row.category,
            content: row.content,
            summary: row.summary,
            author: row.author,
            time: row.publish_time || row.create_time,
            viewCount: row.view_count,
            likeCount: row.like_count,
            sourceUrl: row.source_url
          }));
        } finally {
          conn.release();
        }
      } else if (usersDb) {
        // 使用SQLite
        usersDb.exec(`
          CREATE TABLE IF NOT EXISTS news_articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            source TEXT NOT NULL,
            category TEXT NOT NULL,
            content TEXT NOT NULL,
            summary TEXT,
            author TEXT,
            publish_time TEXT,
            view_count INTEGER DEFAULT 0,
            like_count INTEGER DEFAULT 0,
            source_url TEXT,
            status TEXT DEFAULT 'published',
            create_time TEXT NOT NULL,
            update_time TEXT
          )
        `);

        let whereClause = "status = 'published'";
        const params = [];
        if (category && category !== '全部') {
          whereClause += " AND category = ?";
          params.push(category);
        }

        const countRow = usersDb.prepare(`SELECT COUNT(*) as total FROM news_articles WHERE ${whereClause}`).get(...params);
        total = countRow?.total || 0;

        news = usersDb.prepare(`
          SELECT * FROM news_articles
          WHERE ${whereClause}
          ORDER BY publish_time DESC, create_time DESC
          LIMIT ? OFFSET ?
        `).all(...params, pageSize, offset).map(row => ({
          id: row.id,
          title: row.title,
          source: row.source,
          category: row.category,
          content: row.content,
          summary: row.summary,
          author: row.author,
          time: row.publish_time || row.create_time,
          viewCount: row.view_count,
          likeCount: row.like_count,
          sourceUrl: row.source_url
        }));
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        success: true,
        data: {
          news: news,
          total: total,
          page: page,
          pageSize: pageSize
        }
      }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '获取新闻失败: ' + e.message }));
    }

  } else if (pathname === '/api/admin/news' && req.method === 'POST') {
    // 添加新闻（管理员）
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', async function() {
      try {
        const data = JSON.parse(body || '{}');

        if (!data.title || !data.source || !data.category || !data.content) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '缺少必填字段' }));
          return;
        }

        if (mysqlPool) {
          const conn = await mysqlPool.getConnection();
          try {
            await conn.execute(`
              INSERT INTO news_articles (title, source, category, content, summary, author, publish_time, source_url, status)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              data.title,
              data.source,
              data.category,
              data.content,
              data.summary || data.content.substring(0, 200),
              data.author || '',
              data.publishTime || new Date().toISOString().slice(0, 19).replace('T', ' '),
              data.sourceUrl || '',
              data.status || 'published'
            ]);
          } finally {
            conn.release();
          }
        } else if (usersDb) {
          usersDb.exec(`
            CREATE TABLE IF NOT EXISTS news_articles (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              title TEXT NOT NULL,
              source TEXT NOT NULL,
              category TEXT NOT NULL,
              content TEXT NOT NULL,
              summary TEXT,
              author TEXT,
              publish_time TEXT,
              view_count INTEGER DEFAULT 0,
              like_count INTEGER DEFAULT 0,
              source_url TEXT,
              status TEXT DEFAULT 'published',
              create_time TEXT NOT NULL,
              update_time TEXT
            )
          `);

          usersDb.prepare(`
            INSERT INTO news_articles (title, source, category, content, summary, author, publish_time, source_url, status, create_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            data.title,
            data.source,
            data.category,
            data.content,
            data.summary || data.content.substring(0, 200),
            data.author || '',
            data.publishTime || new Date().toISOString(),
            data.sourceUrl || '',
            data.status || 'published',
            new Date().toISOString()
          );
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '新闻添加成功' }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '添加新闻失败: ' + e.message }));
      }
    });

  } else if (pathname === '/api/admin/news/batch' && req.method === 'POST') {
    // 批量添加新闻（采集时使用）
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', async function() {
      try {
        const data = JSON.parse(body || '{}');
        const articles = data.articles || [];

        if (!articles.length) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '没有新闻数据' }));
          return;
        }

        let inserted = 0;

        if (mysqlPool) {
          const conn = await mysqlPool.getConnection();
          try {
            for (const article of articles) {
              try {
                await conn.execute(`
                  INSERT INTO news_articles (title, source, category, content, summary, author, publish_time, source_url, status)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                  article.title,
                  article.source || '自动采集',
                  article.category || '行业动态',
                  article.content,
                  article.summary || article.content?.substring(0, 200) || '',
                  article.author || '',
                  article.publishTime || new Date().toISOString().slice(0, 19).replace('T', ' '),
                  article.sourceUrl || '',
                  'published'
                ]);
                inserted++;
              } catch (insertErr) {
                // 忽略重复标题等错误
                console.warn('插入新闻失败:', insertErr.message);
              }
            }
          } finally {
            conn.release();
          }
        } else if (usersDb) {
          usersDb.exec(`
            CREATE TABLE IF NOT EXISTS news_articles (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              title TEXT NOT NULL,
              source TEXT NOT NULL,
              category TEXT NOT NULL,
              content TEXT NOT NULL,
              summary TEXT,
              author TEXT,
              publish_time TEXT,
              view_count INTEGER DEFAULT 0,
              like_count INTEGER DEFAULT 0,
              source_url TEXT,
              status TEXT DEFAULT 'published',
              create_time TEXT NOT NULL,
              update_time TEXT
            )
          `);

          const insertStmt = usersDb.prepare(`
            INSERT INTO news_articles (title, source, category, content, summary, author, publish_time, source_url, status, create_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `);

          for (const article of articles) {
            try {
              insertStmt.run(
                article.title,
                article.source || '自动采集',
                article.category || '行业动态',
                article.content,
                article.summary || article.content?.substring(0, 200) || '',
                article.author || '',
                article.publishTime || new Date().toISOString(),
                article.sourceUrl || '',
                'published',
                new Date().toISOString()
              );
              inserted++;
            } catch (insertErr) {
              console.warn('插入新闻失败:', insertErr.message);
            }
          }
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: `成功添加 ${inserted} 条新闻`, inserted: inserted }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '批量添加新闻失败: ' + e.message }));
      }
    });

  // ==================== 在线商城 API ====================

  } else if (pathname === '/api/store/products' && req.method === 'GET') {
    // 获取商品列表
    try {
      let products = [];
      if (mysqlPool) {
        const conn = await mysqlPool.getConnection();
        const [rows] = await conn.execute('SELECT * FROM store_products WHERE status = "active" ORDER BY sales DESC');
        conn.release();
        products = rows;
      } else if (usersDb) {
        products = usersDb.prepare('SELECT * FROM store_products WHERE status = "active" ORDER BY sales DESC').all();
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(products));
    } catch (err) {
      console.error('获取商品列表失败:', err.message);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: err.message }));
    }

  } else if (pathname === '/api/store/cart' && req.method === 'GET') {
    // 获取购物车
    const userId = parsedUrl.query.userId;
    if (!userId) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: '缺少用户ID' }));
    } else {
      try {
        let cart = [];
        if (mysqlPool) {
          const conn = await mysqlPool.getConnection();
          const [rows] = await conn.execute(
            'SELECT c.*, p.name as productName, p.price, p.icon FROM store_cart c LEFT JOIN store_products p ON c.product_id = p.id WHERE c.user_id = ?',
            [userId]
          );
          conn.release();
          cart = rows.map(item => ({
            productId: item.product_id,
            quantity: item.quantity,
            productName: item.productName,
            price: item.price,
            icon: item.icon
          }));
        } else if (usersDb) {
          const rows = usersDb.prepare(`
            SELECT c.*, p.name as productName, p.price, p.icon
            FROM store_cart c
            LEFT JOIN store_products p ON c.product_id = p.id
            WHERE c.user_id = ?
          `).all(userId);
          cart = rows.map(item => ({
            productId: item.product_id,
            quantity: item.quantity,
            productName: item.productName,
            price: item.price,
            icon: item.icon
          }));
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(cart));
      } catch (err) {
        console.error('获取购物车失败:', err.message);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: err.message }));
      }
    }

  } else if (pathname === '/api/store/cart' && req.method === 'POST') {
    // 添加到购物车
    let body = '';
    req.on('data', chunk => body += chunk.toString('utf8'));
    req.on('end', async () => {
      try {
        const { userId, productId, quantity = 1 } = JSON.parse(body || '{}');
        if (!userId || !productId) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: '缺少必要参数' }));
          return;
        }

        if (mysqlPool) {
          const conn = await mysqlPool.getConnection();
          await conn.execute(
            `INSERT INTO store_cart (user_id, product_id, quantity) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
            [userId, productId, quantity, quantity]
          );
          conn.release();
        } else if (usersDb) {
          const existing = usersDb.prepare('SELECT * FROM store_cart WHERE user_id = ? AND product_id = ?').get(userId, productId);
          if (existing) {
            usersDb.prepare('UPDATE store_cart SET quantity = quantity + ? WHERE id = ?').run(quantity, existing.id);
          } else {
            usersDb.prepare('INSERT INTO store_cart (user_id, product_id, quantity) VALUES (?, ?, ?)').run(userId, productId, quantity);
          }
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '已添加到购物车' }));
      } catch (err) {
        console.error('添加购物车失败:', err.message);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: err.message }));
      }
    });

  } else if (pathname === '/api/store/orders' && req.method === 'GET') {
    // 获取订单列表
    const userId = parsedUrl.query.userId;
    if (!userId) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: '缺少用户ID' }));
    } else {
      try {
        let orders = [];
        if (mysqlPool) {
          const conn = await mysqlPool.getConnection();
          const [rows] = await conn.execute(
            'SELECT * FROM store_orders WHERE user_id = ? ORDER BY create_time DESC',
            [userId]
          );
          conn.release();
          orders = rows.map(order => ({
            ...order,
            items: typeof order.items === 'string' ? JSON.parse(order.items) : order.items
          }));
        } else if (usersDb) {
          const rows = usersDb.prepare('SELECT * FROM store_orders WHERE user_id = ? ORDER BY create_time DESC').all(userId);
          orders = rows.map(order => ({
            ...order,
            items: JSON.parse(order.items || '[]')
          }));
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(orders));
      } catch (err) {
        console.error('获取订单列表失败:', err.message);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: err.message }));
      }
    }

  } else if (pathname === '/api/store/orders' && req.method === 'POST') {
    // 创建订单
    let body = '';
    req.on('data', chunk => body += chunk.toString('utf8'));
    req.on('end', async () => {
      try {
        const { userId, items, total, paymentMethod } = JSON.parse(body || '{}');
        if (!userId || !items || !total) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: '缺少必要参数' }));
          return;
        }

        const orderNo = `ORD${Date.now()}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

        if (mysqlPool) {
          const conn = await mysqlPool.getConnection();
          await conn.execute(
            'INSERT INTO store_orders (order_no, user_id, items, total, status, payment_method) VALUES (?, ?, ?, ?, ?, ?)',
            [orderNo, userId, JSON.stringify(items), total, 'pending', paymentMethod || 'wechat']
          );
          await conn.execute('DELETE FROM store_cart WHERE user_id = ?', [userId]);
          conn.release();
        } else if (usersDb) {
          usersDb.prepare(
            'INSERT INTO store_orders (order_no, user_id, items, total, status, payment_method) VALUES (?, ?, ?, ?, ?, ?)'
          ).run(orderNo, userId, JSON.stringify(items), total, 'pending', paymentMethod || 'wechat');
          usersDb.prepare('DELETE FROM store_cart WHERE user_id = ?').run(userId);
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, orderNo, message: '订单创建成功' }));
      } catch (err) {
        console.error('创建订单失败:', err.message);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: err.message }));
      }
    });

  // ==================== 好友系统 API ====================

  } else if (pathname === '/api/friends' && req.method === 'GET') {
    // 获取好友列表
    const userId = parsedUrl.query.userId;
    if (!userId) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: '缺少用户ID' }));
    } else {
      try {
        let friends = [];
        if (mysqlPool) {
          const conn = await mysqlPool.getConnection();
          const [rows] = await conn.execute(
            'SELECT f.friend_id, f.friend_name, f.create_time, u.avatar, u.nickname FROM user_friends f LEFT JOIN users u ON f.friend_id = u.id WHERE f.user_id = ? ORDER BY f.create_time DESC',
            [userId]
          );
          conn.release();
          friends = rows.map(row => ({
            id: row.friend_id,
            name: row.friend_name || row.nickname || '用户',
            avatar: row.avatar,
            time: row.create_time
          }));
        } else if (usersDb) {
          const rows = usersDb.prepare(`
            SELECT f.friend_id, f.friend_name, f.create_time
            FROM user_friends f
            WHERE f.user_id = ?
            ORDER BY f.create_time DESC
          `).all(userId);
          friends = rows.map(row => ({
            id: row.friend_id,
            name: row.friend_name,
            time: row.create_time
          }));
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(friends));
      } catch (err) {
        console.error('获取好友列表失败:', err.message);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: err.message }));
      }
    }

  } else if (pathname === '/api/friends' && req.method === 'POST') {
    // 添加好友
    let body = '';
    req.on('data', chunk => body += chunk.toString('utf8'));
    req.on('end', async () => {
      try {
        const { userId, friendId, friendName } = JSON.parse(body || '{}');
        if (!userId || !friendId) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: '缺少必要参数' }));
          return;
        }

        if (mysqlPool) {
          const conn = await mysqlPool.getConnection();
          // 创建好友表
          await conn.execute(`
            CREATE TABLE IF NOT EXISTS user_friends (
              id INT PRIMARY KEY AUTO_INCREMENT,
              user_id INT NOT NULL,
              friend_id INT NOT NULL,
              friend_name VARCHAR(100),
              create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              UNIQUE KEY unique_friend (user_id, friend_id)
            )
          `);
          // 添加好友关系（双向）
          await conn.execute(
            'INSERT IGNORE INTO user_friends (user_id, friend_id, friend_name) VALUES (?, ?, ?)',
            [userId, friendId, friendName]
          );
          await conn.execute(
            'INSERT IGNORE INTO user_friends (user_id, friend_id, friend_name) VALUES (?, ?, ?)',
            [friendId, userId, null]
          );
          conn.release();
        } else if (usersDb) {
          usersDb.exec(`
            CREATE TABLE IF NOT EXISTS user_friends (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              friend_id INTEGER NOT NULL,
              friend_name TEXT,
              create_time TEXT DEFAULT CURRENT_TIMESTAMP
            )
          `);
          try {
            usersDb.prepare('INSERT INTO user_friends (user_id, friend_id, friend_name) VALUES (?, ?, ?)').run(userId, friendId, friendName);
          } catch (e) { /* 忽略重复 */ }
          try {
            usersDb.prepare('INSERT INTO user_friends (user_id, friend_id, friend_name) VALUES (?, ?, ?)').run(friendId, userId, null);
          } catch (e) { /* 忽略重复 */ }
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '好友添加成功' }));
      } catch (err) {
        console.error('添加好友失败:', err.message);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: err.message }));
      }
    });

  // ==================== 合同管理 API ====================

  } else if (pathname === '/api/contracts' && req.method === 'GET') {
    // 获取合同列表
    try {
      const queryData = querystring.parse(urlParts.query || '');
      const userId = queryData.userId;
      const status = queryData.status || '';
      const keyword = queryData.keyword || '';

      let contracts = [];

      if (mysqlPool) {
        const conn = await mysqlPool.getConnection();
        // 创建合同表
        await conn.execute(`
          CREATE TABLE IF NOT EXISTS contracts (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id VARCHAR(64),
            contract_no VARCHAR(50),
            contract_name VARCHAR(200) NOT NULL,
            party_a VARCHAR(200),
            party_b VARCHAR(200),
            contract_type VARCHAR(50),
            amount DECIMAL(15,2),
            start_date DATE,
            end_date DATE,
            sign_date DATE,
            status VARCHAR(20) DEFAULT 'pending',
            description TEXT,
            attachment VARCHAR(500),
            create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_user_id (user_id),
            INDEX idx_status (status)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        let sql = 'SELECT * FROM contracts WHERE 1=1';
        const params = [];

        if (userId) {
          sql += ' AND user_id = ?';
          params.push(userId);
        }
        if (status) {
          sql += ' AND status = ?';
          params.push(status);
        }
        if (keyword) {
          sql += ' AND (contract_name LIKE ? OR party_a LIKE ? OR party_b LIKE ?)';
          params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
        }
        sql += ' ORDER BY create_time DESC';

        const [rows] = await conn.execute(sql, params);
        contracts = rows.map(row => ({
          id: row.id,
          contractNo: row.contract_no,
          contractName: row.contract_name,
          partyA: row.party_a,
          partyB: row.party_b,
          contractType: row.contract_type,
          amount: parseFloat(row.amount) || 0,
          startDate: row.start_date,
          endDate: row.end_date,
          signDate: row.sign_date,
          status: row.status,
          description: row.description,
          attachment: row.attachment,
          createTime: row.create_time,
          updateTime: row.update_time
        }));
        conn.release();
      } else if (usersDb) {
        usersDb.exec(`
          CREATE TABLE IF NOT EXISTS contracts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT,
            contract_no TEXT,
            contract_name TEXT NOT NULL,
            party_a TEXT,
            party_b TEXT,
            contract_type TEXT,
            amount REAL,
            start_date TEXT,
            end_date TEXT,
            sign_date TEXT,
            status TEXT DEFAULT 'pending',
            description TEXT,
            attachment TEXT,
            create_time TEXT DEFAULT CURRENT_TIMESTAMP,
            update_time TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);

        let sql = 'SELECT * FROM contracts WHERE 1=1';
        const params = [];

        if (userId) {
          sql += ' AND user_id = ?';
          params.push(userId);
        }
        if (status) {
          sql += ' AND status = ?';
          params.push(status);
        }
        if (keyword) {
          sql += ' AND (contract_name LIKE ? OR party_a LIKE ? OR party_b LIKE ?)';
          params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
        }
        sql += ' ORDER BY id DESC';

        const rows = usersDb.prepare(sql).all(...params);
        contracts = rows.map(row => ({
          id: row.id,
          contractNo: row.contract_no,
          contractName: row.contract_name,
          partyA: row.party_a,
          partyB: row.party_b,
          contractType: row.contract_type,
          amount: row.amount || 0,
          startDate: row.start_date,
          endDate: row.end_date,
          signDate: row.sign_date,
          status: row.status,
          description: row.description,
          attachment: row.attachment,
          createTime: row.create_time,
          updateTime: row.update_time
        }));
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, contracts }));
    } catch (err) {
      console.error('获取合同列表失败:', err.message);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: err.message }));
    }

  } else if (pathname === '/api/contracts' && req.method === 'POST') {
    // 保存合同（新增或更新）
    let body = '';
    req.on('data', chunk => body += chunk.toString('utf8'));
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const { id, userId, contractNo, contractName, partyA, partyB, contractType, amount, startDate, endDate, signDate, status, description, attachment } = data;

        if (!contractName) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: '合同名称不能为空' }));
          return;
        }

        if (mysqlPool) {
          const conn = await mysqlPool.getConnection();
          // 确保表存在
          await conn.execute(`
            CREATE TABLE IF NOT EXISTS contracts (
              id INT PRIMARY KEY AUTO_INCREMENT,
              user_id VARCHAR(64),
              contract_no VARCHAR(50),
              contract_name VARCHAR(200) NOT NULL,
              party_a VARCHAR(200),
              party_b VARCHAR(200),
              contract_type VARCHAR(50),
              amount DECIMAL(15,2),
              start_date DATE,
              end_date DATE,
              sign_date DATE,
              status VARCHAR(20) DEFAULT 'pending',
              description TEXT,
              attachment VARCHAR(500),
              create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              INDEX idx_user_id (user_id),
              INDEX idx_status (status)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
          `);

          if (id) {
            // 更新
            await conn.execute(
              `UPDATE contracts SET contract_no=?, contract_name=?, party_a=?, party_b=?, contract_type=?, amount=?, start_date=?, end_date=?, sign_date=?, status=?, description=?, attachment=? WHERE id=?`,
              [contractNo, contractName, partyA, partyB, contractType, amount || 0, startDate, endDate, signDate, status || 'pending', description, attachment, id]
            );
          } else {
            // 新增
            await conn.execute(
              `INSERT INTO contracts (user_id, contract_no, contract_name, party_a, party_b, contract_type, amount, start_date, end_date, sign_date, status, description, attachment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [userId, contractNo, contractName, partyA, partyB, contractType, amount || 0, startDate, endDate, signDate, status || 'pending', description, attachment]
            );
          }
          conn.release();
        } else if (usersDb) {
          usersDb.exec(`
            CREATE TABLE IF NOT EXISTS contracts (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id TEXT,
              contract_no TEXT,
              contract_name TEXT NOT NULL,
              party_a TEXT,
              party_b TEXT,
              contract_type TEXT,
              amount REAL,
              start_date TEXT,
              end_date TEXT,
              sign_date TEXT,
              status TEXT DEFAULT 'pending',
              description TEXT,
              attachment TEXT,
              create_time TEXT DEFAULT CURRENT_TIMESTAMP,
              update_time TEXT DEFAULT CURRENT_TIMESTAMP
            )
          `);

          if (id) {
            usersDb.prepare(`UPDATE contracts SET contract_no=?, contract_name=?, party_a=?, party_b=?, contract_type=?, amount=?, start_date=?, end_date=?, sign_date=?, status=?, description=?, attachment=? WHERE id=?`)
              .run(contractNo, contractName, partyA, partyB, contractType, amount || 0, startDate, endDate, signDate, status || 'pending', description, attachment, id);
          } else {
            usersDb.prepare(`INSERT INTO contracts (user_id, contract_no, contract_name, party_a, party_b, contract_type, amount, start_date, end_date, sign_date, status, description, attachment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
              .run(userId, contractNo, contractName, partyA, partyB, contractType, amount || 0, startDate, endDate, signDate, status || 'pending', description, attachment);
          }
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '合同保存成功' }));
      } catch (err) {
        console.error('保存合同失败:', err.message);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ error: err.message }));
      }
    });

  } else if (pathname.startsWith('/api/contracts/') && req.method === 'DELETE') {
    // 删除合同
    const contractId = pathname.split('/')[3];
    try {
      if (mysqlPool) {
        const conn = await mysqlPool.getConnection();
        await conn.execute('DELETE FROM contracts WHERE id = ?', [contractId]);
        conn.release();
      } else if (usersDb) {
        usersDb.prepare('DELETE FROM contracts WHERE id = ?').run(contractId);
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, message: '合同删除成功' }));
    } catch (err) {
      console.error('删除合同失败:', err.message);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: err.message }));
    }

  // ==================== OCR 工具箱 API（使用阿里云OCR）===================

  // 压缩过大的 base64 图片
  function compressBase64Image(base64Str, maxSizeKB = 1024) {
    let imageData = base64Str;
    if (base64Str.startsWith('data:')) {
      imageData = base64Str.split(',')[1];
    }
    
    const estimatedSize = Math.ceil(imageData.length * 0.75 / 1024);
    
    if (estimatedSize <= maxSizeKB) {
      return base64Str;
    }
    
    if (estimatedSize > 4000) {
      console.warn(`图片过大: ${estimatedSize}KB，建议压缩后上传`);
    }
    
    return base64Str;
  }

  // 阿里云 OCR API 调用
  async function callAliyunOcr(imageBase64, apiType) {
    const crypto = require('crypto');
    const https = require('https');
    
    // 提取纯 base64 数据
    let imageData = imageBase64;
    if (imageBase64.startsWith('data:')) {
      imageData = imageBase64.split(',')[1];
    }
    
    const imageSizeKB = Math.ceil(imageData.length * 0.75 / 1024);
    console.log(`OCR请求图片大小: ${imageSizeKB}KB`);
    
    // 阿里云 OCR API 参数
    const params = {
      Format: 'JSON',
      Version: '2021-07-07',
      AccessKeyId: ALIYUN_ACCESS_KEY_ID,
      SignatureMethod: 'HMAC-SHA1',
      Timestamp: new Date().toISOString(),
      SignatureVersion: '1.0',
      SignatureNonce: Math.random().toString(),
      RegionId: ALIYUN_REGION,
      ImageBase64: imageData
    };
    
    // 生成签名
    const sortedKeys = Object.keys(params).sort();
    const canonicalizedQueryString = sortedKeys.map(key => {
      return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
    }).join('&');
    
    const stringToSign = 'POST&' + encodeURIComponent('/') + '&' + encodeURIComponent(canonicalizedQueryString);
    const signature = crypto.createHmac('sha1', ALIYUN_ACCESS_KEY_SECRET + '&').update(stringToSign).digest('base64');
    
    params.Signature = signature;
    
    const payload = JSON.stringify(params);
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: ALIYUN_ENDPOINT,
        port: 443,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.Code || result.Message) {
              reject(new Error(result.Message || result.Code));
            } else {
              resolve(result);
            }
          } catch (e) {
            reject(new Error('OCR响应解析失败: ' + e.message));
          }
        });
      });
      
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }
  
  // 兼容旧接口名称
  async function callTencentOcr(imageBase64, apiType) {
    return await callAliyunOcr(imageBase64, apiType);
  }

  } else if (pathname === '/api/ocr/general' && req.method === 'POST') {
    // 通用文字识别（图片转文字）
    let body = '';
    req.on('data', chunk => body += chunk.toString('utf8'));
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const imageBase64 = data.image;

        if (!imageBase64) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '请提供图片数据' }));
          return;
        }

        // 调用腾讯云OCR
        const result = await callTencentOcr(imageBase64, 'general');

        // 提取文字
        let textContent = '';
        if (result.TextDetections && Array.isArray(result.TextDetections)) {
          textContent = result.TextDetections.map(item => item.DetectedText || '').join('\n');
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: true,
          text: textContent,
          raw: result
        }));
      } catch (e) {
        console.error('OCR识别失败:', e.message);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: 'OCR识别失败: ' + e.message }));
      }
    });

  } else if (pathname === '/api/ocr/table' && req.method === 'POST') {
    // 表格识别（图片转Excel）
    let body = '';
    req.on('data', chunk => body += chunk.toString('utf8'));
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const imageBase64 = data.image;

        if (!imageBase64) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '请提供图片数据' }));
          return;
        }

        // 调用阿里云表格识别
        const result = await callTencentOcr(imageBase64, 'table');

        // 转换为表格数据
        let tableData = [];
        
        // 阿里云返回格式: { Data: { Regions: [{ Lines: [{ Text: "..." }] }] } }
        if (result.Data && result.Data.Regions && Array.isArray(result.Data.Regions)) {
          result.Data.Regions.forEach(region => {
            if (region.Lines && Array.isArray(region.Lines)) {
              const row = region.Lines.map(line => line.Text || '');
              tableData.push(row);
            }
          });
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: true,
          table: tableData,
          raw: result
        }));
      } catch (e) {
        console.error('表格识别失败:', e.message);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '表格识别失败: ' + e.message }));
      }
    });

  } else if (pathname === '/api/ocr/excel' && req.method === 'POST') {
    // 图片转Excel（生成可下载的CSV文件）
    let body = '';
    req.on('data', chunk => body += chunk.toString('utf8'));
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const imageBase64 = data.image;

        if (!imageBase64) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '请提供图片数据' }));
          return;
        }

        // 调用阿里云通用OCR
        const result = await callTencentOcr(imageBase64, 'table');

        // 解析阿里云OCR响应，尝试识别表格结构
        let tableData = [];
        let csvContent = '';
        
        // 阿里云 OCR 返回格式: { Data: { Regions: [{ Lines: [{ Text: "..." }] }] } }
        if (result.Data && result.Data.Regions && Array.isArray(result.Data.Regions)) {
          const lines = [];
          result.Data.Regions.forEach(region => {
            if (region.Lines && Array.isArray(region.Lines)) {
              region.Lines.forEach(line => {
                lines.push(line.Text || '');
              });
            }
          });
          tableData = lines.map(line => [line]);
          
          // 转换为CSV
          csvContent = tableData.map(row =>
            row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(',')
          ).join('\n');
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: true,
          csv: csvContent,
          filename: 'table_' + Date.now() + '.csv',
          table: tableData
        }));
      } catch (e) {
        console.error('Excel转换失败:', e.message);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: 'Excel转换失败: ' + e.message }));
      }
    });

  } else if (pathname === '/api/ocr/word' && req.method === 'POST') {
    // 图片转Word（生成可下载的文本文件）
    let body = '';
    req.on('data', chunk => body += chunk.toString('utf8'));
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const imageBase64 = data.image;

        if (!imageBase64) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '请提供图片数据' }));
          return;
        }

        // 调用腾讯云OCR
        const result = await callTencentOcr(imageBase64, 'general');

        // 提取文字（按阅读顺序排列）
        let textContent = '';
        if (result.TextDetections && Array.isArray(result.TextDetections)) {
          // 按Y坐标分行，再按X坐标排序
          const lines = {};
          result.TextDetections.forEach(item => {
            const y = Math.round(item.Polygon.Y || item.Rectangle.Y || 0);
            if (!lines[y]) lines[y] = [];
            lines[y].push({
              text: item.DetectedText || '',
              x: item.Polygon.X || item.Rectangle.X || 0
            });
          });
          
          const sortedKeys = Object.keys(lines).sort((a, b) => parseInt(a) - parseInt(b));
          textContent = sortedKeys.map(y => {
            const rowItems = lines[y].sort((a, b) => a.x - b.x);
            return rowItems.map(item => item.text).join(' ');
          }).join('\n');
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: true,
          text: textContent,
          filename: 'document_' + Date.now() + '.txt'
        }));
      } catch (e) {
        console.error('Word转换失败:', e.message);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: 'Word转换失败: ' + e.message }));
      }
    });

  // 腾讯云表格识别专用API
  async function callTencentOcrTable(imageBase64) {
    const crypto = require('crypto');
    const https = require('https');
    
    const host = 'ocr.tencentcloudapi.com';
    const path = '/';
    const region = 'ap-guangzhou';
    const service = 'ocr';
    const version = '2018-11-19';
    const algorithm = 'TC3-HMAC-SHA256';
    const action = 'RecognizeTableOCR'; // 表格识别专用API
    
    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().split('T')[0];
    
    const httpRequestMethod = 'POST';
    const canonicalUri = '/';
    const canonicalQueryString = '';
    const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${host}\n`;
    const signedHeaders = 'content-type;host';
    
    let imageData = imageBase64;
    if (imageBase64.startsWith('data:')) {
      imageData = imageBase64.split(',')[1];
    }
    
    const payload = JSON.stringify({
      ImageBase64: imageData,
      ReturnText: true // 返回文字内容
    });
    
    const hashedRequestPayload = crypto.createHash('sha256').update(payload).digest('hex');
    const canonicalRequest = `${httpRequestMethod}\n${canonicalUri}\n${canonicalQueryString}\n${canonicalHeaders}\n${signedHeaders}\n${hashedRequestPayload}`;
    
    const credentialScope = `${date}/${service}/tc3_request`;
    const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
    const stringToSign = `${algorithm}\n${timestamp}\n${credentialScope}\n${hashedCanonicalRequest}`;
    
    const secretKey = TENCENT_SECRET_KEY;
    const secretDate = crypto.createHmac('sha256', `TC3${secretKey}`).update(date).digest();
    const secretService = crypto.createHmac('sha256', secretDate).update(service).digest();
    const secretSigning = crypto.createHmac('sha256', secretService).update('tc3_request').digest();
    const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex');
    
    const authorization = `${algorithm} Credential=${TENCENT_SECRET_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: host,
        port: 443,
        path: path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Host': host,
          'X-TC-Action': action,
          'X-TC-Version': version,
          'X-TC-Timestamp': timestamp.toString(),
          'X-TC-Region': region,
          'Authorization': authorization,
          'Content-Length': Buffer.byteLength(payload)
        }
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (result.Response && result.Response.Error) {
              reject(new Error(result.Response.Error.Message || '表格识别失败'));
            } else if (result.Response) {
              resolve(result.Response);
            } else {
              reject(new Error('OCR响应格式错误'));
            }
          } catch (e) {
            reject(new Error('OCR响应解析失败: ' + e.message));
          }
        });
      });
      
      req.on('error', (e) => {
        reject(new Error('OCR请求失败: ' + e.message));
      });
      
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('OCR请求超时'));
      });
      
      req.write(payload);
      req.end();
    });
  }

  } else if (pathname === '/api/ocr/test' && req.method === 'GET') {
    // OCR配置测试
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      configured: !!(ALIYUN_ACCESS_KEY_ID && ALIYUN_ACCESS_KEY_SECRET),
      provider: 'aliyun',
      message: '阿里云OCR已配置'
    }));

  } else if (pathname === '/api/ocr/direct-test' && req.method === 'POST') {
    // 直接测试OCR API（调试用）
    let body = '';
    req.on('data', chunk => body += chunk.toString('utf8'));
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const imageBase64 = data.image || 'test';
        const type = data.type || 'general';
        
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: true,
          message: 'OCR测试端点正常',
          provider: 'tencent',
          type: type,
          imageLength: imageBase64.length
        }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: e.message }));
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

  } else if (pathname === '/api/templates' && req.method === 'GET') {
    // 获取模板列表
    try {
      let templates = [];
      const category = query.category || 'all';
      const industry = query.industry || null;

      if (usersDb) {
        let sql = 'SELECT * FROM templates WHERE status = ?';
        const params = ['active'];

        if (category !== 'all') {
          sql += ' AND category = ?';
          params.push(category);
        }
        if (industry) {
          sql += ' AND (industry = ? OR industry IS NULL)';
          params.push(industry);
        }
        sql += ' ORDER BY download_count DESC, create_time DESC';

        templates = usersDb.prepare(sql).all(...params);
      }

      // 如果数据库为空，返回默认模板
      if (templates.length === 0) {
        templates = getDefaultTemplates();
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, templates }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: e.message }));
    }

  } else if (pathname === '/api/templates' && req.method === 'POST') {
    // 添加模板
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const templateId = 'tpl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

        if (usersDb) {
          usersDb.prepare(`
            INSERT INTO templates (template_id, title, description, category, industry, format, icon, file_path, create_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(templateId, data.title, data.description, data.category, data.industry || null, data.format || 'Excel', data.icon || '📄', data.file_path || null, new Date().toISOString());
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, template_id: templateId }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });

  } else if (pathname === '/api/templates/download' && req.method === 'POST') {
    // 增加下载次数
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if (usersDb) {
          usersDb.prepare('UPDATE templates SET download_count = download_count + 1 WHERE template_id = ?').run(data.template_id);
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });

  } else if (pathname === '/api/tools' && req.method === 'GET') {
    // 获取工具列表
    try {
      let tools = [];
      if (usersDb) {
        tools = usersDb.prepare('SELECT * FROM tools WHERE status = ? ORDER BY create_time DESC').all('active');
      }

      // 如果数据库为空，返回默认工具
      if (tools.length === 0) {
        tools = getDefaultTools();
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, tools }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: e.message }));
    }

  } else if (pathname === '/api/membership/plans' && req.method === 'GET') {
    // 获取会员套餐列表
    try {
      let plans = [];
      if (usersDb) {
        plans = usersDb.prepare('SELECT * FROM membership_plans WHERE status = ? ORDER BY price ASC').all('active');
      }
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, plans }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: e.message }));
    }

  } else if (pathname === '/api/membership/status' && req.method === 'GET') {
    // 获取用户会员状态
    try {
      const userId = parsedUrl.query.user_id;
      if (!userId) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '缺少用户ID' }));
        return;
      }

      let membership = null;
      if (usersDb) {
        membership = usersDb.prepare(`
          SELECT um.*, mp.name as plan_name, mp.features
          FROM user_memberships um
          JOIN membership_plans mp ON um.plan_id = mp.plan_id
          WHERE um.user_id = ? AND um.status = ? AND um.end_time > ?
          ORDER BY um.end_time DESC
          LIMIT 1
        `).get(userId, 'active', new Date().toISOString());
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, membership }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: e.message }));
    }

  } else if (pathname === '/api/user/upgrade' && req.method === 'POST') {
    // 用户升级（个人用户升级为企业/机构用户）
    let body = '';
    req.on('data', chunk => body += chunk.toString('utf8'));
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const { phone, newUsername, upgradeType, companyName, creditCode } = data;

        if (!phone || !newUsername || !upgradeType) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '缺少必要参数' }));
          return;
        }

        if (upgradeType !== 'enterprise' && upgradeType !== 'institution') {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '无效的升级类型' }));
          return;
        }

        if (mysqlPool) {
          const conn = await mysqlPool.getConnection();

          // 检查用户名是否已存在
          const [existingUsers] = await conn.execute(
            'SELECT id FROM users WHERE username = ? AND user_type = ?',
            [newUsername, upgradeType]
          );
          if (existingUsers.length > 0) {
            conn.release();
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: '用户名已存在，请更换' }));
            return;
          }

          // 获取原个人用户信息
          const [personalUsers] = await conn.execute(
            'SELECT * FROM users WHERE phone = ? AND user_type = ?',
            [phone, 'personal']
          );
          if (personalUsers.length === 0) {
            conn.release();
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: '原个人账户不存在' }));
            return;
          }

          const personalUser = personalUsers[0];
          const newUserId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          const now = new Date();

          // 创建新的企业/机构账户
          await conn.execute(
            `INSERT INTO users (id, username, phone, password, user_type, enterprise_name, credit_code, contact_person, industry, member_points, credit_score, account_balance, exclusive_services, create_time, update_time)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [newUserId, newUsername, phone, personalUser.password, upgradeType, companyName || null, creditCode || null, personalUser.username || null, personalUser.industry || null, personalUser.member_points || 0, personalUser.credit_score || 0, personalUser.account_balance || 0, personalUser.exclusive_services || 0, now, now]
          );

          conn.release();

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            success: true,
            message: '升级成功',
            user: {
              id: newUserId,
              username: newUsername,
              user_type: upgradeType,
              enterprise_name: companyName
            }
          }));
        } else if (usersDb) {
          // 检查用户名是否已存在
          const existingUser = usersDb.prepare('SELECT id FROM users WHERE username = ? AND user_type = ?').get(newUsername, upgradeType);
          if (existingUser) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: '用户名已存在，请更换' }));
            return;
          }

          // 获取原个人用户信息
          const personalUser = usersDb.prepare('SELECT * FROM users WHERE phone = ? AND user_type = ?').get(phone, 'personal');
          if (!personalUser) {
            res.statusCode = 404;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: '原个人账户不存在' }));
            return;
          }

          const newUserId = 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          const now = new Date().toISOString();

          // 创建新的企业/机构账户
          usersDb.prepare(
            `INSERT INTO users (id, username, phone, password, user_type, enterprise_name, credit_code, contact_person, industry, member_points, credit_score, account_balance, exclusive_services, create_time, update_time)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(newUserId, newUsername, phone, personalUser.password, upgradeType, companyName || null, creditCode || null, personalUser.username || null, personalUser.industry || null, personalUser.member_points || 0, personalUser.credit_score || 0, personalUser.account_balance || 0, personalUser.exclusive_services || 0, now, now);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({
            success: true,
            message: '升级成功',
            user: {
              id: newUserId,
              username: newUsername,
              user_type: upgradeType,
              enterprise_name: companyName
            }
          }));
        } else {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库不可用' }));
        }
      } catch (e) {
        console.error('用户升级失败:', e);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });

  } else if (pathname === '/api/user/profile' && req.method === 'GET') {
    // 获取用户资料（从数据库）
    try {
      const userId = parsedUrl.query.user_id || parsedUrl.query.phone;
      if (!userId) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '缺少用户ID' }));
        return;
      }

      let user = null;
      if (mysqlPool) {
        // 使用MySQL
        const [rows] = await mysqlPool.execute(
          'SELECT id, username, phone, user_type, institution_type, institution_name, enterprise_name, credit_code, contact_person, industry, member_points, member_expiry, credit_score, account_balance, exclusive_services, create_time FROM users WHERE phone = ? OR id = ?',
          [userId, userId]
        );
        user = rows[0];
      } else if (usersDb) {
        // 使用SQLite作为备用
        user = usersDb.prepare(
          'SELECT id, username, phone, user_type, institution_type, institution_name, enterprise_name, credit_code, contact_person, industry, member_points, member_expiry, credit_score, account_balance, exclusive_services, create_time FROM users WHERE phone = ? OR id = ?'
        ).get(userId, userId);
      }

      if (!user) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '用户不存在' }));
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, user }));
    } catch (e) {
      console.error('获取用户资料失败:', e);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: e.message }));
    }

  } else if (pathname === '/api/user/wallet' && req.method === 'GET') {
    // 获取用户钱包信息（从数据库）
    try {
      const userId = parsedUrl.query.user_id || parsedUrl.query.phone;
      if (!userId) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '缺少用户ID' }));
        return;
      }

      let user = null;
      if (mysqlPool) {
        // 使用MySQL
        const [rows] = await mysqlPool.execute(
          'SELECT account_balance, member_points, credit_score FROM users WHERE phone = ? OR id = ?',
          [userId, userId]
        );
        user = rows[0];
      } else if (usersDb) {
        // 使用SQLite作为备用
        user = usersDb.prepare(
          'SELECT account_balance, member_points, credit_score FROM users WHERE phone = ? OR id = ?'
        ).get(userId, userId);
      }

      if (!user) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '用户不存在' }));
        return;
      }

      // 获取交易记录
      let transactions = [];
      if (mysqlPool) {
        const [rows] = await mysqlPool.execute(
          'SELECT * FROM user_transactions WHERE user_id = ? ORDER BY create_time DESC LIMIT 20',
          [userId]
        );
        transactions = rows;
      } else if (usersDb) {
        transactions = usersDb.prepare(
          'SELECT * FROM user_transactions WHERE user_id = ? ORDER BY create_time DESC LIMIT 20'
        ).all(userId);
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        success: true,
        wallet: {
          balance: user.account_balance || 0,
          points: user.member_points || 0,
          creditScore: user.credit_score || 0
        },
        transactions
      }));
    } catch (e) {
      console.error('获取钱包信息失败:', e);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: e.message }));
    }

  } else if (pathname === '/api/user/transactions' && req.method === 'GET') {
    // 获取用户交易记录
    try {
      const userId = parsedUrl.query.user_id || parsedUrl.query.phone;
      const page = parseInt(parsedUrl.query.page) || 1;
      const pageSize = parseInt(parsedUrl.query.pageSize) || 20;
      const offset = (page - 1) * pageSize;

      if (!userId) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '缺少用户ID' }));
        return;
      }

      let transactions = [];
      let total = 0;

      if (mysqlPool) {
        const [rows] = await mysqlPool.execute(
          'SELECT * FROM user_transactions WHERE user_id = ? ORDER BY create_time DESC LIMIT ? OFFSET ?',
          [userId, pageSize, offset]
        );
        transactions = rows;
        const [countRows] = await mysqlPool.execute(
          'SELECT COUNT(*) as total FROM user_transactions WHERE user_id = ?',
          [userId]
        );
        total = countRows[0].total;
      } else if (usersDb) {
        transactions = usersDb.prepare(
          'SELECT * FROM user_transactions WHERE user_id = ? ORDER BY create_time DESC LIMIT ? OFFSET ?'
        ).all(userId, pageSize, offset);
        total = usersDb.prepare(
          'SELECT COUNT(*) as total FROM user_transactions WHERE user_id = ?'
        ).get(userId).total;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        success: true,
        transactions,
        total,
        page,
        pageSize
      }));
    } catch (e) {
      console.error('获取交易记录失败:', e);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: e.message }));
    }

  } else if (pathname === '/api/membership/create-order' && req.method === 'POST') {
    // 创建会员购买订单
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { user_id, plan_id, payment_method } = data;

        if (!user_id || !plan_id || !payment_method) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '参数不完整' }));
          return;
        }

        // 获取套餐信息
        const plan = usersDb.prepare('SELECT * FROM membership_plans WHERE plan_id = ? AND status = ?').get(plan_id, 'active');
        if (!plan) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '套餐不存在' }));
          return;
        }

        const orderId = 'VIP_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        const description = `购买${plan.name}`;

        // 创建支付订单
        orders[orderId] = {
          orderId,
          amount: plan.price,
          description,
          paymentMethod: payment_method,
          status: 'pending',
          userId: user_id,
          planId: plan_id,
          planName: plan.name,
          durationDays: plan.duration_days,
          createTime: new Date().toISOString(),
          updateTime: new Date().toISOString()
        };
        saveOrders();

        // 生成支付参数
        let payParams = {};
        if (payment_method === 'wechat') {
          // 微信支付 - Native模式
          const wechatParams = {
            appid: paymentConfig.wechat.appId,
            mch_id: paymentConfig.wechat.mchId,
            nonce_str: WechatPay.generateNonceStr(),
            body: description,
            out_trade_no: orderId,
            total_fee: plan.price,
            spbill_create_ip: '127.0.0.1',
            notify_url: paymentConfig.wechat.notifyUrl,
            trade_type: 'NATIVE'
          };
          wechatParams.sign = WechatPay.generateSign(wechatParams, paymentConfig.wechat.apiKey);

          // 调用微信统一下单API
          try {
            const wechatResult = await WechatPay.unifiedOrder(wechatParams);
            console.log('微信统一下单结果:', wechatResult);

            if (wechatResult.return_code === 'SUCCESS' && wechatResult.result_code === 'SUCCESS') {
              payParams = {
                code_url: wechatResult.code_url,
                orderId: orderId
              };
            } else {
              // 如果调用失败，返回错误信息
              const errorMsg = wechatResult.return_msg || wechatResult.err_code_des || '微信支付下单失败';
              console.error('微信支付下单失败:', wechatResult);
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json; charset=utf-8');
              res.end(JSON.stringify({ success: false, message: errorMsg }));
              return;
            }
          } catch (wechatError) {
            console.error('调用微信支付API失败:', wechatError);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: false, message: '微信支付服务暂时不可用，请稍后重试' }));
            return;
          }
        } else if (payment_method === 'alipay') {
          const bizContent = {
            out_trade_no: orderId,
            product_code: 'FAST_INSTANT_TRADE_PAY',
            total_amount: (plan.price / 100).toFixed(2),
            subject: description
          };

          const host = req.headers.host || 'localhost:3000';
          const protocol = host.includes('localhost') || host.match(/^\d+\.\d+\.\d+\.\d+/) ? 'http' : 'https';
          const returnUrl = `${protocol}://${host}/member.html?tab=membership&payment=success`;

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
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: true,
          orderId: orderId,
          amount: plan.price,
          planName: plan.name,
          payParams: payParams
        }));
      } catch (e) {
        console.error('创建会员订单失败:', e);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });

  } else if (pathname === '/api/forum/posts' && req.method === 'GET') {
    // 获取帖子列表
    try {
      const urlParts = url.parse(req.url, true);
      const category = urlParts.query.category || 'all';
      const search = urlParts.query.search || '';
      const page = parseInt(urlParts.query.page) || 1;
      const pageSize = parseInt(urlParts.query.pageSize) || 10;
      const offset = (page - 1) * pageSize;

      let whereClause = 'WHERE status = ?';
      let params = ['published'];

      if (category && category !== 'all') {
        whereClause += ' AND category = ?';
        params.push(category);
      }

      if (search) {
        whereClause += ' AND (title LIKE ? OR content LIKE ?)';
        params.push('%' + search + '%', '%' + search + '%');
      }

      if (mysqlPool) {
        // 使用MySQL
        const countSql = `SELECT COUNT(*) as total FROM forum_posts ${whereClause}`;
        const [countRows] = await mysqlPool.execute(countSql, params);
        const total = countRows[0].total;

        const sql = `SELECT p.*,
          (SELECT COUNT(*) FROM forum_comments WHERE post_id = p.id) as comment_count,
          (SELECT COUNT(*) FROM forum_likes WHERE post_id = p.id) as like_count
          FROM forum_posts p ${whereClause} ORDER BY create_time DESC LIMIT ? OFFSET ?`;
        const [posts] = await mysqlPool.execute(sql, [...params, pageSize, offset]);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: true,
          posts: posts.map(p => ({
            ...p,
            tags: p.tags ? (typeof p.tags === 'string' ? JSON.parse(p.tags) : p.tags) : []
          })),
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize)
        }));
      } else if (usersDb) {
        // 使用SQLite作为备用
        const countSql = `SELECT COUNT(*) as total FROM forum_posts ${whereClause}`;
        const totalResult = usersDb.prepare(countSql).get(...params);
        const total = totalResult.total;

        const sql = `SELECT p.*,
          (SELECT COUNT(*) FROM forum_comments WHERE post_id = p.id) as comment_count,
          (SELECT COUNT(*) FROM forum_likes WHERE post_id = p.id) as like_count
          FROM forum_posts p ${whereClause} ORDER BY create_time DESC LIMIT ? OFFSET ?`;
        params.push(pageSize, offset);

        const posts = usersDb.prepare(sql).all(...params);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: true,
          posts: posts.map(p => ({
            ...p,
            tags: p.tags ? JSON.parse(p.tags) : []
          })),
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize)
        }));
      } else {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '数据库未初始化' }));
      }
    } catch (e) {
      console.error('获取帖子列表失败:', e);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: e.message }));
    }

  } else if (pathname === '/api/forum/post' && req.method === 'GET') {
    // 获取单个帖子详情
    try {
      const urlParts = url.parse(req.url, true);
      const postId = urlParts.query.id;

      if (!postId) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '帖子ID不能为空' }));
        return;
      }

      if (mysqlPool) {
        // 使用MySQL
        await mysqlPool.execute('UPDATE forum_posts SET views = views + 1 WHERE id = ?', [postId]);

        const [postRows] = await mysqlPool.execute(`
          SELECT p.*,
            (SELECT COUNT(*) FROM forum_comments WHERE post_id = p.id) as comment_count,
            (SELECT COUNT(*) FROM forum_likes WHERE post_id = p.id) as like_count
          FROM forum_posts p WHERE p.id = ?
        `, [postId]);

        const post = postRows[0];

        if (!post) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '帖子不存在' }));
          return;
        }

        const [comments] = await mysqlPool.execute('SELECT * FROM forum_comments WHERE post_id = ? ORDER BY create_time ASC', [postId]);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: true,
          post: {
            ...post,
            tags: post.tags ? (typeof post.tags === 'string' ? JSON.parse(post.tags) : post.tags) : []
          },
          comments
        }));
      } else if (usersDb) {
        // 使用SQLite作为备用
        usersDb.prepare('UPDATE forum_posts SET views = views + 1 WHERE id = ?').run(postId);

        const post = usersDb.prepare(`
          SELECT p.*,
            (SELECT COUNT(*) FROM forum_comments WHERE post_id = p.id) as comment_count,
            (SELECT COUNT(*) FROM forum_likes WHERE post_id = p.id) as like_count
          FROM forum_posts p WHERE p.id = ?
        `).get(postId);

        if (!post) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '帖子不存在' }));
          return;
        }

        const comments = usersDb.prepare('SELECT * FROM forum_comments WHERE post_id = ? ORDER BY create_time ASC').all(postId);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: true,
          post: {
            ...post,
            tags: post.tags ? JSON.parse(post.tags) : []
          },
          comments
        }));
      } else {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '数据库未初始化' }));
      }
    } catch (e) {
      console.error('获取帖子详情失败:', e);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: e.message }));
    }

  } else if (pathname === '/api/forum/post' && req.method === 'POST') {
    // 创建新帖子
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { title, content, author_id, author_name, category, tags } = data;

        if (!title || !content || !author_id || !author_name) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '参数不完整' }));
          return;
        }

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        if (mysqlPool) {
          // 使用MySQL
          const [result] = await mysqlPool.execute(`
            INSERT INTO forum_posts (title, content, author_id, author_name, category, tags, create_time, update_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [title, content, author_id, author_name, category || 'other', JSON.stringify(tags || []), now, now]);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, postId: result.insertId }));
        } else if (usersDb) {
          // 使用SQLite作为备用
          const result = usersDb.prepare(`
            INSERT INTO forum_posts (title, content, author_id, author_name, category, tags, create_time, update_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(title, content, author_id, author_name, category || 'other', JSON.stringify(tags || []), now, now);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, postId: result.lastInsertRowid }));
        } else {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库未初始化' }));
        }
      } catch (e) {
        console.error('创建帖子失败:', e);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });

  } else if (pathname === '/api/forum/comment' && req.method === 'POST') {
    // 添加评论
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { post_id, author_id, author_name, content } = data;

        if (!post_id || !author_id || !author_name || !content) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '参数不完整' }));
          return;
        }

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        if (mysqlPool) {
          // 使用MySQL
          const [result] = await mysqlPool.execute(`
            INSERT INTO forum_comments (post_id, author_id, author_name, content, create_time)
            VALUES (?, ?, ?, ?, ?)
          `, [post_id, author_id, author_name, content, now]);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, commentId: result.insertId }));
        } else if (usersDb) {
          // 使用SQLite作为备用
          const result = usersDb.prepare(`
            INSERT INTO forum_comments (post_id, author_id, author_name, content, create_time)
            VALUES (?, ?, ?, ?, ?)
          `).run(post_id, author_id, author_name, content, now);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: true, commentId: result.lastInsertRowid }));
        } else {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库未初始化' }));
        }
      } catch (e) {
        console.error('添加评论失败:', e);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });

  } else if (pathname === '/api/forum/like' && req.method === 'POST') {
    // 点赞/取消点赞
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { post_id, user_id } = data;

        if (!post_id || !user_id) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '参数不完整' }));
          return;
        }

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        if (mysqlPool) {
          // 使用MySQL
          const [existingRows] = await mysqlPool.execute('SELECT * FROM forum_likes WHERE post_id = ? AND user_id = ?', [post_id, user_id]);

          if (existingRows.length > 0) {
            // 取消点赞
            await mysqlPool.execute('DELETE FROM forum_likes WHERE post_id = ? AND user_id = ?', [post_id, user_id]);
            await mysqlPool.execute('UPDATE forum_posts SET likes = GREATEST(0, likes - 1) WHERE id = ?', [post_id]);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true, liked: false }));
          } else {
            // 添加点赞
            await mysqlPool.execute('INSERT INTO forum_likes (post_id, user_id, create_time) VALUES (?, ?, ?)', [post_id, user_id, now]);
            await mysqlPool.execute('UPDATE forum_posts SET likes = likes + 1 WHERE id = ?', [post_id]);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true, liked: true }));
          }
        } else if (usersDb) {
          // 使用SQLite作为备用
          const existing = usersDb.prepare('SELECT * FROM forum_likes WHERE post_id = ? AND user_id = ?').get(post_id, user_id);

          if (existing) {
            // 取消点赞
            usersDb.prepare('DELETE FROM forum_likes WHERE post_id = ? AND user_id = ?').run(post_id, user_id);
            usersDb.prepare('UPDATE forum_posts SET likes = likes - 1 WHERE id = ?').run(post_id);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true, liked: false }));
          } else {
            // 添加点赞
            usersDb.prepare('INSERT INTO forum_likes (post_id, user_id, create_time) VALUES (?, ?, ?)').run(post_id, user_id, now);
            usersDb.prepare('UPDATE forum_posts SET likes = likes + 1 WHERE id = ?').run(post_id);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true, liked: true }));
          }
        } else {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库未初始化' }));
        }
      } catch (e) {
        console.error('点赞操作失败:', e);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });

  } else if (pathname === '/api/forum/bookmark' && req.method === 'POST') {
    // 收藏/取消收藏
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { post_id, user_id } = data;

        if (!post_id || !user_id) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '参数不完整' }));
          return;
        }

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        if (mysqlPool) {
          // 使用MySQL
          const [existingRows] = await mysqlPool.execute('SELECT * FROM forum_bookmarks WHERE post_id = ? AND user_id = ?', [post_id, user_id]);

          if (existingRows.length > 0) {
            // 取消收藏
            await mysqlPool.execute('DELETE FROM forum_bookmarks WHERE post_id = ? AND user_id = ?', [post_id, user_id]);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true, bookmarked: false }));
          } else {
            // 添加收藏
            await mysqlPool.execute('INSERT INTO forum_bookmarks (post_id, user_id, create_time) VALUES (?, ?, ?)', [post_id, user_id, now]);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true, bookmarked: true }));
          }
        } else if (usersDb) {
          // 使用SQLite作为备用
          const existing = usersDb.prepare('SELECT * FROM forum_bookmarks WHERE post_id = ? AND user_id = ?').get(post_id, user_id);

          if (existing) {
            // 取消收藏
            usersDb.prepare('DELETE FROM forum_bookmarks WHERE post_id = ? AND user_id = ?').run(post_id, user_id);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true, bookmarked: false }));
          } else {
            // 添加收藏
            usersDb.prepare('INSERT INTO forum_bookmarks (post_id, user_id, create_time) VALUES (?, ?, ?)').run(post_id, user_id, now);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ success: true, bookmarked: true }));
          }
        } else {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库未初始化' }));
        }
      } catch (e) {
        console.error('收藏操作失败:', e);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });

  } else if (pathname === '/api/forum/hot-posts' && req.method === 'GET') {
    // 获取热门帖子
    try {
      const limit = parseInt(url.parse(req.url, true).query.limit) || 5;

      if (mysqlPool) {
        // 使用MySQL
        const [posts] = await mysqlPool.execute(`
          SELECT id, title, likes,
            (SELECT COUNT(*) FROM forum_comments WHERE post_id = forum_posts.id) as comment_count
          FROM forum_posts WHERE status = 'published'
          ORDER BY likes DESC, comment_count DESC LIMIT ?
        `, [limit]);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, posts }));
      } else if (usersDb) {
        // 使用SQLite作为备用
        const posts = usersDb.prepare(`
          SELECT id, title, likes,
            (SELECT COUNT(*) FROM forum_comments WHERE post_id = forum_posts.id) as comment_count
          FROM forum_posts WHERE status = 'published'
          ORDER BY likes DESC, comment_count DESC LIMIT ?
        `).all(limit);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, posts }));
      } else {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '数据库未初始化' }));
      }
    } catch (e) {
      console.error('获取热门帖子失败:', e);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: e.message }));
    }

  } else if (pathname === '/api/knowledge/articles' && req.method === 'GET') {
    // 获取知识库文章列表
    try {
      if (mysqlPool) {
        // 使用MySQL
        const [articles] = await mysqlPool.execute('SELECT * FROM knowledge_articles WHERE status = ? ORDER BY create_time DESC', ['published']);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, articles }));
      } else if (usersDb) {
        // 使用SQLite作为备用
        const articles = usersDb.prepare('SELECT * FROM knowledge_articles WHERE status = ? ORDER BY create_time DESC').all('published');

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, articles }));
      } else {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '数据库未初始化' }));
      }
    } catch (e) {
      console.error('获取知识库文章失败:', e);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: e.message }));
    }

  } else if (pathname === '/api/forum/user-status' && req.method === 'GET') {
    // 获取用户对帖子的点赞/收藏状态
    try {
      const urlParts = url.parse(req.url, true);
      const postId = urlParts.query.post_id;
      const userId = urlParts.query.user_id;

      if (!postId || !userId) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '参数不完整' }));
        return;
      }

      if (mysqlPool) {
        // 使用MySQL
        const [likedRows] = await mysqlPool.execute('SELECT * FROM forum_likes WHERE post_id = ? AND user_id = ?', [postId, userId]);
        const [bookmarkedRows] = await mysqlPool.execute('SELECT * FROM forum_bookmarks WHERE post_id = ? AND user_id = ?', [postId, userId]);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: true,
          liked: likedRows.length > 0,
          bookmarked: bookmarkedRows.length > 0
        }));
      } else if (usersDb) {
        // 使用SQLite作为备用
        const liked = usersDb.prepare('SELECT * FROM forum_likes WHERE post_id = ? AND user_id = ?').get(postId, userId);
        const bookmarked = usersDb.prepare('SELECT * FROM forum_bookmarks WHERE post_id = ? AND user_id = ?').get(postId, userId);

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: true,
          liked: !!liked,
          bookmarked: !!bookmarked
        }));
      } else {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '数据库未初始化' }));
      }
    } catch (e) {
      console.error('获取用户状态失败:', e);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: e.message }));
    }

  // ==================== 云盘API ====================
  } else if (pathname === '/api/cloud/files' && req.method === 'GET') {
    // 获取文件列表
    try {
      const urlParts = url.parse(req.url, true);
      const userId = urlParts.query.user_id || 'demo';
      const category = urlParts.query.category || 'all';
      const folderId = urlParts.query.folder_id || 0;

      let sql = 'SELECT * FROM cloud_files WHERE user_id = ?';
      let params = [userId];

      if (category && category !== 'all') {
        sql += ' AND category = ?';
        params.push(category);
      }

      sql += ' AND folder_id = ? ORDER BY type DESC, create_time DESC';
      params.push(folderId);

      let files, totalSize;
      if (mysqlPool) {
        const [rows] = await mysqlPool.execute(sql, params);
        files = rows;
        const [sizeRows] = await mysqlPool.execute('SELECT COALESCE(SUM(size), 0) as total FROM cloud_files WHERE user_id = ?', [userId]);
        totalSize = sizeRows[0].total;
      } else if (usersDb) {
        files = usersDb.prepare(sql).all(...params);
        totalSize = usersDb.prepare('SELECT COALESCE(SUM(size), 0) as total FROM cloud_files WHERE user_id = ?').get(userId).total;
      } else {
        files = [];
        totalSize = 0;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        success: true,
        files: files,
        storage: {
          used: totalSize,
          total: 10 * 1024 * 1024 * 1024 // 10GB
        }
      }));
    } catch (e) {
      console.error('获取云盘文件失败:', e);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: e.message }));
    }

  } else if (pathname === '/api/cloud/file' && req.method === 'POST') {
    // 创建文件/文件夹
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { user_id, name, type, size, folder_id, category } = data;

        if (!name || !type) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '参数不完整' }));
          return;
        }

        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        let insertId;

        if (mysqlPool) {
          const [result] = await mysqlPool.execute(
            'INSERT INTO cloud_files (user_id, name, type, size, folder_id, category, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [user_id || 'demo', name, type, size || 0, folder_id || 0, category || 'all', now, now]
          );
          insertId = result.insertId;
        } else if (usersDb) {
          const result = usersDb.prepare(`
            INSERT INTO cloud_files (user_id, name, type, size, folder_id, category, create_time, update_time)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(user_id || 'demo', name, type, size || 0, folder_id || 0, category || 'all', now, now);
          insertId = result.lastInsertRowid;
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, fileId: insertId }));
      } catch (e) {
        console.error('创建文件失败:', e);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });

  } else if (pathname === '/api/cloud/file' && req.method === 'DELETE') {
    // 删除文件
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { id, user_id } = data;

        if (!id) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '文件ID不能为空' }));
          return;
        }

        if (mysqlPool) {
          await mysqlPool.execute('DELETE FROM cloud_files WHERE id = ? AND user_id = ?', [id, user_id || 'demo']);
        } else if (usersDb) {
          usersDb.prepare('DELETE FROM cloud_files WHERE id = ? AND user_id = ?').run(id, user_id || 'demo');
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        console.error('删除文件失败:', e);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });

  } else if (pathname === '/api/cloud/share' && req.method === 'POST') {
    // 分享文件
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { id, password, expiry } = data;

        if (!id) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '文件ID不能为空' }));
          return;
        }

        const shareLink = 'https://zonya.work/share/' + Date.now();
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

        if (mysqlPool) {
          await mysqlPool.execute(
            'UPDATE cloud_files SET is_shared = 1, share_link = ?, share_password = ?, share_expiry = ?, update_time = ? WHERE id = ?',
            [shareLink, password || null, expiry || null, now, id]
          );
        } else if (usersDb) {
          usersDb.prepare(`
            UPDATE cloud_files SET is_shared = 1, share_link = ?, share_password = ?, share_expiry = ?, update_time = ?
            WHERE id = ?
          `).run(shareLink, password || null, expiry || null, now, id);
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, shareLink: shareLink }));
      } catch (e) {
        console.error('分享文件失败:', e);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });

  // ================================================
  // 费用报销 API
  // ================================================
  } else if (pathname === '/api/expenses' && req.method === 'GET') {
    // GET /api/expenses - 查询报销单列表
    const { userId, search, type, dateFrom, dateTo, status, page, limit } = parsedUrl.query;
    let sql = 'SELECT id, expense_no AS expenseNo, title AS expenseType, expense_type AS expenseTypeRaw, amount, expense_date AS expenseDate, reason, status, user_id AS userId, user_name AS userName, approver, approved_time AS approvedTime, paid_time AS paidTime, create_time AS createdAt, images, verified_invoices AS verifiedInvoices, reject_reason AS rejectReason, paid_at AS paidAt FROM expense_reimbursements WHERE 1=1';
    let countSql = 'SELECT COUNT(*) as total FROM expense_reimbursements WHERE 1=1';
    const params = [];
    if (userId) { sql += ' AND user_id=?'; countSql += ' AND user_id=?'; params.push(userId); }
    if (search) { sql += ' AND (title LIKE ? OR description LIKE ? OR expense_no LIKE ?)'; countSql += ' AND (title LIKE ? OR description LIKE ? OR expense_no LIKE ?)'; const s='%'+search+'%'; params.push(s, s, s); }
    if (type) { sql += ' AND expense_type=?'; countSql += ' AND expense_type=?'; params.push(type); }
    if (dateFrom) { sql += ' AND expense_date>=?'; countSql += ' AND expense_date>=?'; params.push(dateFrom); }
    if (dateTo) { sql += ' AND expense_date<=?'; countSql += ' AND expense_date<=?'; params.push(dateTo); }
    if (status) { sql += ' AND status=?'; countSql += ' AND status=?'; params.push(status); }
    sql += ' ORDER BY create_time DESC';
    const pg = parseInt(page) || 1;
    const lm = parseInt(limit) || 50;
    sql += ` LIMIT ${lm} OFFSET ${(pg-1)*lm}`;
    try {
      let rows = [], total = 0;
      if (mysqlPool) {
        const [r, [cnt]] = await Promise.all([
          mysqlPool.execute(sql, params),
          mysqlPool.execute(countSql, params)
        ]);
        rows = r;
        total = cnt.total;
      } else if (usersDb) {
        rows = usersDb.prepare(sql).all(...params);
        total = usersDb.prepare(countSql).get(...params).total;
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, data: rows, total }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, message: e.message }));
    }

  } else if (pathname === '/api/expenses' && req.method === 'POST') {
    // POST /api/expenses - 新建报销单
    let body = '';
    req.on('data', c => body += c.toString('utf8'));
    req.on('end', async () => {
      try {
        const d = JSON.parse(body);
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const expenseNo = 'BX' + new Date().getFullYear() + String(new Date().getMonth()+1).padStart(2,'0') + String(Date.now()).slice(-4);
        const images = d.images ? JSON.stringify(d.images) : null;
        const verifiedInvoices = d.verifiedInvoices ? JSON.stringify(d.verifiedInvoices) : null;
        const sql = `INSERT INTO expense_reimbursements (expense_no, title, expense_type, amount, expense_date, reason, status, user_id, user_name, images, verified_invoices, create_time, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?)`;
        const vals = [expenseNo, d.title||d.expenseType||'报销', d.expenseType, d.amount, d.expenseDate, d.reason, d.userId, d.userName||'未知用户', images, verifiedInvoices, now, now];
        let insertId;
        if (mysqlPool) {
          const [r] = await mysqlPool.execute(sql, vals);
          insertId = r.insertId;
        } else if (usersDb) {
          const info = usersDb.prepare(sql).run(...vals);
          insertId = info.lastInsertRowid;
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, data: { id: insertId, expenseNo } }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });

  } else if (pathname.startsWith('/api/expenses/') && pathname.endsWith('/status') && req.method === 'PUT') {
    // PUT /api/expenses/:id/status - 更新报销单状态（审批/打款）
    const id = pathname.split('/')[3];
    let body = '';
    req.on('data', c => body += c.toString('utf8'));
    req.on('end', async () => {
      try {
        const d = JSON.parse(body);
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        let sql = 'UPDATE expense_reimbursements SET status=?, updated_at=?';
        const params = [d.status, now];
        if (d.status === 'rejected' && d.rejectReason) { sql += ', reject_reason=?'; params.push(d.rejectReason); }
        if (d.status === 'paid') { sql += ', paid_at=?'; params.push(now); }
        if (d.approverName) {
          sql += ', approver=?, approved_time=?'; params.push(d.approverName, now);
        }
        sql += ' WHERE id=?';
        params.push(id);
        if (mysqlPool) {
          await mysqlPool.execute(sql, params);
        } else if (usersDb) {
          usersDb.prepare(sql).run(...params);
        }
        // 记录审批
        if (d.status === 'approved' || d.status === 'rejected') {
          const approverId = d.approverId || 'ADMIN';
          const approverName = d.approverName || '管理员';
          if (mysqlPool) {
            await mysqlPool.execute('INSERT INTO expense_approvals (expense_id, approver_id, approver_name, status, comment, created_at) VALUES (?,?,?,?,?,?)', [id, approverId, approverName, d.status, d.comment||'', now]);
          } else if (usersDb) {
            usersDb.prepare('INSERT INTO expense_approvals (expense_id, approver_id, approver_name, status, comment, created_at) VALUES (?,?,?,?,?,?)').run(id, approverId, approverName, d.status, d.comment||'', now);
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });

  } else if (pathname === '/api/expenses/upload' && req.method === 'POST') {
    // POST /api/expenses/upload - 上传发票附件图片
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', async () => {
      try {
        const buf = Buffer.concat(chunks);
        const boundary = (req.headers['content-type'] || '').match(/boundary=(?:"([^"]+)"|([^\s;]+))/);
        if (!boundary) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, message: 'No boundary found' }));
          return;
        }
        const b = boundary[1] || boundary[2];
        const parts = buf.toString('binary').split('--' + b);
        let fileUrl = '', fileName = '';
        for (const part of parts) {
          const m = part.match(/filename="([^"]+)"/);
          if (m) { fileName = m[1]; break; }
        }
        const uploadDir = path.join(__dirname, 'uploads', 'expenses');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
        const fn = Date.now() + '_' + Math.random().toString(36).slice(2) + '_' + fileName;
        const fp = path.join(uploadDir, fn);
        fs.writeFileSync(fp, buf);
        fileUrl = '/uploads/expenses/' + fn;
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, data: { url: fileUrl, name: fileName } }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: e.message }));
      }
    });

  } else if (pathname === '/api/expenses/check-duplicate' && req.method === 'POST') {
    // POST /api/expenses/check-duplicate - 发票查重
    let body = '';
    req.on('data', c => body += c.toString('utf8'));
    req.on('end', async () => {
      try {
        const { code, number, amount, date } = JSON.parse(body);
        if (!code || !number) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true, duplicate: false }));
          return;
        }
        let rows = [];
        if (mysqlPool) {
          const [r] = await mysqlPool.execute(
            `SELECT * FROM expense_invoices WHERE invoice_code=? AND invoice_number=? AND amount=? LIMIT 5`,
            [code, number, amount || 0]
          );
          rows = r;
        } else if (usersDb) {
          rows = usersDb.prepare(`SELECT * FROM expense_invoices WHERE invoice_code=? AND invoice_number=? AND amount=? LIMIT 5`).all(code, number, amount || 0);
        }
        const duplicate = rows.length > 0;
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, duplicate, records: rows }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, message: e.message }));
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

// 开通会员
function activateMembership(order) {
  if (!order || !order.userId || !order.planId || !order.durationDays) {
    console.error('激活会员失败: 订单信息不完整', order);
    return false;
  }

  try {
    // 检查是否有现有会员
    const existingMembership = usersDb.prepare(`
      SELECT * FROM user_memberships
      WHERE user_id = ? AND status = ? AND end_time > ?
      ORDER BY end_time DESC LIMIT 1
    `).get(order.userId, 'active', new Date().toISOString());

    let startTime;
    if (existingMembership) {
      // 在现有会员基础上续期
      startTime = new Date(existingMembership.end_time);
    } else {
      // 新开通会员
      startTime = new Date();
    }

    const endTime = new Date(startTime.getTime() + order.durationDays * 24 * 60 * 60 * 1000);

    usersDb.prepare(`
      INSERT INTO user_memberships (user_id, plan_id, order_id, start_time, end_time, status, payment_method, amount, create_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      order.userId,
      order.planId,
      order.orderId,
      startTime.toISOString(),
      endTime.toISOString(),
      'active',
      order.paymentMethod,
      order.amount,
      new Date().toISOString()
    );

    console.log(`会员开通成功: 用户 ${order.userId}, 套餐 ${order.planName}, 有效期至 ${endTime.toISOString()}`);
    return true;
  } catch (e) {
    console.error('激活会员失败:', e);
    return false;
  }
}

// 默认模板数据
function getDefaultTemplates() {
  return [
    // 行业模板 - 再生资源
    { template_id: 'tpl_recycling_1', title: '♻️ 再生资源回收进货单模板', description: '适用于再生资源行业，包含废品分类、重量、单价、供应商信息等', category: 'industry', industry: 'recycling_resource', format: 'Excel', icon: '♻️', download_count: 156 },
    { template_id: 'tpl_recycling_2', title: '♻️ 再生资源损耗核算表', description: '追踪回收物资的加工损耗、运输损耗，自动计算损耗率', category: 'industry', industry: 'recycling_resource', format: 'Excel', icon: '♻️', download_count: 98 },
    { template_id: 'tpl_recycling_3', title: '♻️ 再生资源税负分析表', description: '分析回收行业增值税税负，包含进项抵扣、简易计税等项目', category: 'industry', industry: 'recycling_resource', format: 'Excel', icon: '♻️', download_count: 87 },
    // 行业模板 - 商贸批发
    { template_id: 'tpl_wholesale_1', title: '📦 商品进销存管理表', description: '商贸批发行业专用，包含商品编码、库存数量、进价、售价、毛利', category: 'industry', industry: 'commodity_wholesale', format: 'Excel', icon: '📦', download_count: 234 },
    { template_id: 'tpl_wholesale_2', title: '📦 批发客户往来对账单', description: '管理批发客户应收账款，自动计算账龄和回款率', category: 'industry', industry: 'commodity_wholesale', format: 'Excel', icon: '📦', download_count: 178 },
    { template_id: 'tpl_wholesale_3', title: '📦 毛利分析报表', description: '按商品类别分析毛利率，支持多维度毛利分析', category: 'industry', industry: 'commodity_wholesale', format: 'Excel', icon: '📦', download_count: 145 },
    // 行业模板 - 制造业
    { template_id: 'tpl_manufacturing_1', title: '🏭 生产成本核算表', description: '制造业专用，包含直接材料、直接人工、制造费用分摊', category: 'industry', industry: 'manufacturing_general', format: 'Excel', icon: '🏭', download_count: 189 },
    { template_id: 'tpl_manufacturing_2', title: '🏭 材料领用明细表', description: '追踪生产车间材料领用，支持按订单、产品归集成本', category: 'industry', industry: 'manufacturing_general', format: 'Excel', icon: '🏭', download_count: 156 },
    { template_id: 'tpl_manufacturing_3', title: '🏭 在制品盘点表', description: '月末盘点在制品，自动计算约当产量', category: 'industry', industry: 'manufacturing_general', format: 'Excel', icon: '🏭', download_count: 123 },
    // 行业模板 - 商务服务
    { template_id: 'tpl_service_1', title: '🏢 项目成本核算表', description: '服务业专用，按项目归集人工成本、外包费用、差旅费等', category: 'industry', industry: 'business_service', format: 'Excel', icon: '🏢', download_count: 167 },
    { template_id: 'tpl_service_2', title: '🏢 服务项目回款跟踪表', description: '管理服务合同回款进度，自动提醒应收账款', category: 'industry', industry: 'business_service', format: 'Excel', icon: '🏢', download_count: 134 },
    // 行业模板 - 软件开发
    { template_id: 'tpl_software_1', title: '💻 研发费用归集表', description: '软件行业专用，归集研发人员工资、设备折旧、外包费用', category: 'industry', industry: 'software_dev', format: 'Excel', icon: '💻', download_count: 198 },
    { template_id: 'tpl_software_2', title: '💻 研发费用加计扣除计算表', description: '自动计算研发费用加计扣除金额，支持税务申报', category: 'industry', industry: 'software_dev', format: 'Excel', icon: '💻', download_count: 176 },
    { template_id: 'tpl_software_3', title: '💻 项目收入确认表', description: '按项目进度确认软件收入，支持里程碑法、完工百分比法', category: 'industry', industry: 'software_dev', format: 'Excel', icon: '💻', download_count: 145 },
    // 财务报表模板
    { template_id: 'tpl_finance_1', title: '资产负债表模板', description: '标准企业资产负债表模板，包含资产、负债和所有者权益三大类', category: 'finance', industry: null, format: 'Excel', icon: '📊', download_count: 1254 },
    { template_id: 'tpl_finance_2', title: '利润表模板', description: '企业利润表模板，自动计算营业收入、成本和利润', category: 'finance', industry: null, format: 'Excel', icon: '📈', download_count: 987 },
    { template_id: 'tpl_finance_3', title: '现金流量表模板', description: '企业现金流量表模板，包含经营、投资和筹资活动现金流', category: 'finance', industry: null, format: 'Excel', icon: '💵', download_count: 865 },
    // 税务申报模板
    { template_id: 'tpl_tax_1', title: '增值税申报表模板', description: '增值税一般纳税人申报表模板，自动计算应纳税额', category: 'tax', industry: null, format: 'Excel', icon: '🧾', download_count: 1567 },
    { template_id: 'tpl_tax_2', title: '企业所得税申报表模板', description: '企业所得税年度申报表模板，包含收入、成本、费用等项目', category: 'tax', industry: null, format: 'Excel', icon: '📋', download_count: 1123 },
    // 合同模板
    { template_id: 'tpl_contract_1', title: '借款合同模板', description: '企业借款合同模板，包含借款金额、利率、还款方式等条款', category: 'contract', industry: null, format: 'Word', icon: '📝', download_count: 654 },
    { template_id: 'tpl_contract_2', title: '采购合同模板', description: '企业采购合同模板，包含商品名称、数量、价格等条款', category: 'contract', industry: null, format: 'Word', icon: '📝', download_count: 892 },
    // 财务制度模板
    { template_id: 'tpl_system_1', title: '财务管理制度模板', description: '企业财务管理制度模板，包含会计核算、资金管理等内容', category: 'system', industry: null, format: 'Word', icon: '📑', download_count: 789 }
  ];
}

// 演示发票数据
function getDemoInvoices() {
  const today = new Date();
  const formatDate = (d) => d.toISOString().slice(0, 10);
  return [
    {
      id: 1,
      invoice_no: 'INV-2026-001',
      customer_name: '北京科技有限公司',
      amount: 15000.00,
      tax_rate: 0.13,
      tax_amount: 1950.00,
      total_amount: 16950.00,
      invoice_date: formatDate(new Date(today - 5 * 24 * 60 * 60 * 1000)),
      status: 'paid',
      invoice_type: 'sales',
      description: '软件开发服务费'
    },
    {
      id: 2,
      invoice_no: 'INV-2026-002',
      customer_name: '上海贸易公司',
      amount: 10000.00,
      tax_rate: 0.13,
      tax_amount: 1300.00,
      total_amount: 11300.00,
      invoice_date: formatDate(new Date(today - 6 * 24 * 60 * 60 * 1000)),
      status: 'unpaid',
      invoice_type: 'sales',
      description: '商品销售'
    },
    {
      id: 3,
      invoice_no: 'INV-2026-003',
      customer_name: '广州制造企业',
      amount: 8500.00,
      tax_rate: 0.13,
      tax_amount: 1105.00,
      total_amount: 9605.00,
      invoice_date: formatDate(new Date(today - 7 * 24 * 60 * 60 * 1000)),
      status: 'pending',
      invoice_type: 'sales',
      description: '设备维护费'
    },
    {
      id: 4,
      invoice_no: 'INV-2026-004',
      customer_name: '深圳科技公司',
      amount: 12000.00,
      tax_rate: 0.13,
      tax_amount: 1560.00,
      total_amount: 13560.00,
      invoice_date: formatDate(new Date(today - 8 * 24 * 60 * 60 * 1000)),
      status: 'paid',
      invoice_type: 'sales',
      description: '技术咨询费'
    },
    {
      id: 5,
      invoice_no: 'INV-2026-005',
      customer_name: '杭州电商平台',
      amount: 9500.00,
      tax_rate: 0.13,
      tax_amount: 1235.00,
      total_amount: 10735.00,
      invoice_date: formatDate(new Date(today - 9 * 24 * 60 * 60 * 1000)),
      status: 'unpaid',
      invoice_type: 'sales',
      description: '平台服务费'
    },
    {
      id: 6,
      invoice_no: 'INV-2026-006',
      customer_name: '成都物流公司',
      amount: 6800.00,
      tax_rate: 0.09,
      tax_amount: 612.00,
      total_amount: 7412.00,
      invoice_date: formatDate(new Date(today - 10 * 24 * 60 * 60 * 1000)),
      status: 'paid',
      invoice_type: 'sales',
      description: '运输服务费'
    },
    {
      id: 7,
      invoice_no: 'INV-2026-007',
      customer_name: '武汉建筑公司',
      amount: 25000.00,
      tax_rate: 0.09,
      tax_amount: 2250.00,
      total_amount: 27250.00,
      invoice_date: formatDate(new Date(today - 11 * 24 * 60 * 60 * 1000)),
      status: 'pending',
      invoice_type: 'sales',
      description: '工程咨询服务'
    },
    {
      id: 8,
      invoice_no: 'INV-2026-008',
      customer_name: '南京医药公司',
      amount: 18000.00,
      tax_rate: 0.13,
      tax_amount: 2340.00,
      total_amount: 20340.00,
      invoice_date: formatDate(new Date(today - 12 * 24 * 60 * 60 * 1000)),
      status: 'paid',
      invoice_type: 'sales',
      description: '药品销售'
    }
  ];
}

// 默认工具数据
function getDefaultTools() {
  return [
    { tool_id: 'tool_1', title: '发票识别', description: '上传发票图片，自动识别发票信息并生成凭证', icon: '📄', category: 'finance' },
    { tool_id: 'tool_2', title: '银行对账', description: '上传银行对账单，自动与企业账务进行对账', icon: '🏦', category: 'finance' },
    { tool_id: 'tool_3', title: '财务计算', description: '提供各种财务计算功能，如现值、终值、年金等', icon: '🧮', category: 'calculate' },
    { tool_id: 'tool_4', title: '汇率转换', description: '实时汇率查询和货币转换工具', icon: '💱', category: 'finance' },
    { tool_id: 'tool_5', title: '票据管理', description: '管理企业各类票据，包括发票、收据、支票等', icon: '📋', category: 'manage' }
  ];
}

// ============================================================
// 新闻自动采集定时任务
// ============================================================
let newsCollectorInterval = null;

async function collectNewsTask() {
  console.log(`[${new Date().toISOString()}] 开始自动采集新闻...`);

  // 模拟采集的新闻数据
  const mockArticles = [
    {
      title: '财政部发布最新会计准则修订通知',
      source: '财政部官网',
      category: '财务政策',
      content: '财政部近日发布通知，对现行会计准则进行部分修订，主要涉及收入确认、租赁会计等方面。企业需要在规定时间内完成相关调整，确保财务报表符合新准则要求。',
      publishTime: new Date().toISOString().slice(0, 19).replace('T', ' ')
    },
    {
      title: '增值税留抵退税政策延续实施',
      source: '税务总局网站',
      category: '税务政策',
      content: '国家税务总局发布公告，增值税留抵退税政策将继续实施，符合条件的纳税人可按规定申请退还增量留抵税额。此举旨在进一步减轻企业负担，促进经济高质量发展。',
      publishTime: new Date().toISOString().slice(0, 19).replace('T', ' ')
    },
    {
      title: '企业所得税年度汇算清缴注意事项',
      source: '税务研究',
      category: '税务政策',
      content: '随着企业所得税年度汇算清缴工作的开展，税务部门提醒纳税人注意申报时限、优惠政策适用条件等关键事项。建议企业提前准备相关资料，确保申报准确无误。',
      publishTime: new Date().toISOString().slice(0, 19).replace('T', ' ')
    },
    {
      title: '数字化转型助力企业财务管理升级',
      source: '中国会计报',
      category: '行业动态',
      content: '越来越多的企业开始推进财务数字化转型，通过引入智能财务系统、RPA机器人等技术手段，提升财务工作效率和准确性。专家表示，数字化转型已成为企业财务管理的必然趋势。',
      publishTime: new Date().toISOString().slice(0, 19).replace('T', ' ')
    },
    {
      title: '电子发票全面推广应用进展顺利',
      source: '财务与会计',
      category: '技术应用',
      content: '国家税务总局持续推进电子发票应用，目前已在多个行业和地区实现全覆盖。电子发票的推广有效降低了企业开票成本，提高了发票管理效率，受到纳税人普遍欢迎。',
      publishTime: new Date().toISOString().slice(0, 19).replace('T', ' ')
    }
  ];

  try {
    let inserted = 0;

    if (mysqlPool) {
      const conn = await mysqlPool.getConnection();
      try {
        // 确保表存在
        await conn.execute(`
          CREATE TABLE IF NOT EXISTS news_articles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(500) NOT NULL,
            source VARCHAR(100) NOT NULL,
            category VARCHAR(50) NOT NULL,
            content TEXT NOT NULL,
            summary TEXT,
            author VARCHAR(100),
            publish_time DATETIME,
            view_count INT DEFAULT 0,
            like_count INT DEFAULT 0,
            source_url VARCHAR(500),
            status VARCHAR(20) DEFAULT 'published',
            create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
            update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_category (category),
            INDEX idx_status (status),
            INDEX idx_publish_time (publish_time)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        for (const article of mockArticles) {
          try {
            await conn.execute(`
              INSERT INTO news_articles (title, source, category, content, summary, publish_time, status)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [
              article.title,
              article.source,
              article.category,
              article.content,
              article.content.substring(0, 200),
              article.publishTime,
              'published'
            ]);
            inserted++;
          } catch (insertErr) {
            // 忽略重复等错误
          }
        }
      } finally {
        conn.release();
      }
    } else if (usersDb) {
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS news_articles (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          source TEXT NOT NULL,
          category TEXT NOT NULL,
          content TEXT NOT NULL,
          summary TEXT,
          author TEXT,
          publish_time TEXT,
          view_count INTEGER DEFAULT 0,
          like_count INTEGER DEFAULT 0,
          source_url TEXT,
          status TEXT DEFAULT 'published',
          create_time TEXT NOT NULL,
          update_time TEXT
        )
      `);

      const insertStmt = usersDb.prepare(`
        INSERT INTO news_articles (title, source, category, content, summary, publish_time, status, create_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const article of mockArticles) {
        try {
          insertStmt.run(
            article.title,
            article.source,
            article.category,
            article.content,
            article.content.substring(0, 200),
            article.publishTime,
            'published',
            new Date().toISOString()
          );
          inserted++;
        } catch (insertErr) {
          // 忽略错误
        }
      }
    }

    console.log(`[${new Date().toISOString()}] 新闻采集完成，新增 ${inserted} 条`);
  } catch (e) {
    console.error('新闻采集失败:', e.message);
  }
}

// 启动新闻采集定时任务（每24小时）
function startNewsCollector() {
  // 立即执行一次
  setTimeout(collectNewsTask, 60000); // 服务器启动1分钟后首次执行

  // 每24小时执行一次
  newsCollectorInterval = setInterval(collectNewsTask, 24 * 60 * 60 * 1000);

  console.log('新闻自动采集任务已启动，每24小时采集一次');
}

// ========== 在线商城API ==========

// 商城商品表初始化
async function initStoreTables() {
  if (mysqlPool) {
    try {
      const conn = await mysqlPool.getConnection();
      await conn.execute(`
        CREATE TABLE IF NOT EXISTS store_products (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          price DECIMAL(10, 2) NOT NULL,
          icon VARCHAR(50),
          sales INT DEFAULT 0,
          rating DECIMAL(2, 1) DEFAULT 5.0,
          category VARCHAR(50),
          status VARCHAR(20) DEFAULT 'active',
          create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      await conn.execute(`
        CREATE TABLE IF NOT EXISTS store_cart (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL,
          product_id INT NOT NULL,
          quantity INT DEFAULT 1,
          create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_user_product (user_id, product_id)
        )
      `);

      await conn.execute(`
        CREATE TABLE IF NOT EXISTS store_orders (
          id INT PRIMARY KEY AUTO_INCREMENT,
          order_no VARCHAR(50) NOT NULL,
          user_id INT NOT NULL,
          items JSON,
          total DECIMAL(10, 2) NOT NULL,
          status VARCHAR(20) DEFAULT 'pending',
          payment_method VARCHAR(50),
          payment_time TIMESTAMP NULL,
          create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      // 插入默认商品
      const [products] = await conn.execute('SELECT COUNT(*) as count FROM store_products');
      if (products[0].count === 0) {
        const defaultProducts = [
          ['金蝶KIS专业版', '企业级财务管理软件，提供会计核算、进销存、工资管理等功能', 8800.00, '💾', 1254, 4.9, 'software'],
          ['用友U8', '大型企业管理软件，涵盖财务、供应链、生产制造等多个模块', 15800.00, '📊', 987, 4.8, 'software'],
          ['财务分析与决策课程', '掌握财务分析的核心方法，提升企业决策能力', 299.00, '📈', 2345, 4.9, 'course'],
          ['财务计算器专业版', '提供各种财务计算功能，如现值、终值、年金等', 199.00, '🧮', 1567, 4.7, 'tool'],
          ['财务办公套装', '包含财务专用计算器、印章、文件夹等办公用品', 299.00, '🏢', 892, 4.6, 'office'],
          ['财务模板大全', '包含财务报表、税务申报、合同等各类模板', 149.00, '📄', 1123, 4.8, 'template']
        ];

        for (const product of defaultProducts) {
          await conn.execute(
            'INSERT INTO store_products (name, description, price, icon, sales, rating, category) VALUES (?, ?, ?, ?, ?, ?, ?)',
            product
          );
        }
        console.log('默认商品数据已插入');
      }

      conn.release();
      console.log('商城数据表初始化完成');
    } catch (err) {
      console.error('商城数据表初始化失败:', err.message);
    }
  } else if (usersDb) {
    usersDb.exec(`
      CREATE TABLE IF NOT EXISTS store_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        icon TEXT,
        sales INTEGER DEFAULT 0,
        rating REAL DEFAULT 5.0,
        category TEXT,
        status TEXT DEFAULT 'active',
        create_time TEXT DEFAULT CURRENT_TIMESTAMP,
        update_time TEXT
      )
    `);

    usersDb.exec(`
      CREATE TABLE IF NOT EXISTS store_cart (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER DEFAULT 1,
        create_time TEXT DEFAULT CURRENT_TIMESTAMP,
        update_time TEXT
      )
    `);

    usersDb.exec(`
      CREATE TABLE IF NOT EXISTS store_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_no TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        items TEXT,
        total REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        payment_method TEXT,
        payment_time TEXT,
        create_time TEXT DEFAULT CURRENT_TIMESTAMP,
        update_time TEXT
      )
    `);

    // 插入默认商品
    const count = usersDb.prepare('SELECT COUNT(*) as count FROM store_products').get();
    if (count.count === 0) {
      const insertStmt = usersDb.prepare('INSERT INTO store_products (name, description, price, icon, sales, rating, category) VALUES (?, ?, ?, ?, ?, ?, ?)');
      const defaultProducts = [
        ['金蝶KIS专业版', '企业级财务管理软件，提供会计核算、进销存、工资管理等功能', 8800.00, '💾', 1254, 4.9, 'software'],
        ['用友U8', '大型企业管理软件，涵盖财务、供应链、生产制造等多个模块', 15800.00, '📊', 987, 4.8, 'software'],
        ['财务分析与决策课程', '掌握财务分析的核心方法，提升企业决策能力', 299.00, '📈', 2345, 4.9, 'course'],
        ['财务计算器专业版', '提供各种财务计算功能，如现值、终值、年金等', 199.00, '🧮', 1567, 4.7, 'tool'],
        ['财务办公套装', '包含财务专用计算器、印章、文件夹等办公用品', 299.00, '🏢', 892, 4.6, 'office'],
        ['财务模板大全', '包含财务报表、税务申报、合同等各类模板', 149.00, '📄', 1123, 4.8, 'template']
      ];
      for (const product of defaultProducts) {
        insertStmt.run(product);
      }
      console.log('默认商品数据已插入(SQLite)');
    }
  }
}

// 初始化数据库
initMainDb();
initStoreTables();

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
  console.log(`  GET  /api/news                 - 获取新闻列表`);
  console.log(`  POST /api/admin/news           - 添加新闻(管理员)`);
  console.log(`  POST /api/admin/news/batch     - 批量添加新闻`);
  console.log(`  GET  /api/expenses            - 查询报销单列表`);
  console.log(`  POST /api/expenses            - 新建报销单`);
  console.log(`  PUT  /api/expenses/:id/status - 更新报销单状态`);
  console.log(`  POST /api/expenses/upload     - 上传发票附件`);
  console.log(`  POST /api/expenses/check-duplicate - 发票查重`);
  console.log(`========================================\n`);

  // 启动新闻自动采集
  startNewsCollector();
});
