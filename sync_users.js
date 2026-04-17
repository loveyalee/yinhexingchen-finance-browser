const mysql = require('mysql2/promise');
const Database = require('better-sqlite3');

async function syncUsers() {
  // 读取本地SQLite用户
  const localDb = new Database('db/users.db');
  const localUsers = localDb.prepare('SELECT * FROM users').all();
  console.log('本地SQLite用户数:', localUsers.length);

  // 连接MySQL
  const pool = mysql.createPool({
    host: 'rm-bp1t731ujc98jo9c10o.mysql.rds.aliyuncs.com',
    port: 3306,
    user: 'ram_dingding',
    password: 'h5J5BVEXtrjKVDSxmS4w',
    database: 'rds_dingding'
  });

  let synced = 0;
  
  // 打印要同步的字段列表
  console.log('字段数量:', 19);

  for (const user of localUsers) {
    try {
      const createTime = user.create_time ? new Date(user.create_time) : new Date();
      const updateTime = user.update_time ? new Date(user.update_time) : new Date();
      const lastSyncTime = user.last_sync_time ? new Date(user.last_sync_time) : new Date();

      const values = [
        user.id,
        user.username,
        user.phone,
        user.password,
        user.user_type,
        user.institution_type || '',
        user.institution_name || '',
        user.credit_code || '',
        user.contact_person || '',
        user.industry || '',
        user.local_db_file || '',
        user.cloud_backup_file || '',
        user.sync_status || 'synced',
        lastSyncTime,
        user.member_points || 0,
        user.credit_score || 0,
        user.account_balance || 0,
        user.exclusive_services || 0,
        createTime,
        updateTime
      ];
      
      console.log('用户', user.phone, 'values count:', values.length);
      console.log('具体值:', JSON.stringify(values));

      // 直接用query避免预处理问题
      const sql = `INSERT INTO users (id, username, phone, password, user_type, institution_type, institution_name, credit_code, contact_person, industry, local_db_file, cloud_backup_file, sync_status, last_sync_time, member_points, credit_score, account_balance, exclusive_services, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      
      await pool.query(sql, values);
      synced++;
      console.log('已同步:', user.phone);
    } catch (e) {
      console.log('同步失败', user.phone, ':', e.message);
    }
  }

  const [rows] = await pool.query('SELECT id, phone, username, user_type, create_time FROM users');
  console.log('MySQL用户数:', rows.length);
  rows.forEach(u => console.log(' -', u.phone, '(' + u.user_type + ')'));

  await pool.end();
  console.log('\n同步完成! 共', synced, '条记录');
}

syncUsers().catch(console.error);