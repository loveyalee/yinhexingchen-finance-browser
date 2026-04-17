/**
 * 数据库辅助模块 - 支持MySQL和SQLite双数据库
 * MySQL为主数据库，SQLite为本地备份
 */

// 检查是否使用MySQL
function useMySQL() {
  return mysqlPool !== null;
}

// 用户相关操作
const UserDB = {
  // 查找用户（支持用户名或手机号）
  async findByAccount(account) {
    if (useMySQL()) {
      const [rows] = await mysqlPool.execute(
        'SELECT * FROM users WHERE username = ? OR phone = ? LIMIT 1',
        [account, account]
      );
      return rows[0] || null;
    } else if (usersDb) {
      let user = usersDb.prepare('SELECT * FROM users WHERE username = ?').get(account);
      if (!user) {
        user = usersDb.prepare('SELECT * FROM users WHERE phone = ?').get(account);
      }
      return user;
    } else {
      return memoryUsers.find(u => u.username === account || u.phone === account) || null;
    }
  },

  // 通过ID查找用户
  async findById(userId) {
    if (useMySQL()) {
      const [rows] = await mysqlPool.execute(
        'SELECT * FROM users WHERE id = ? LIMIT 1',
        [userId]
      );
      return rows[0] || null;
    } else if (usersDb) {
      return usersDb.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    } else {
      return memoryUsers.find(u => u.id === userId) || null;
    }
  },

  // 检查手机号是否存在（指定用户类型）
  async phoneExists(phone, userType) {
    if (useMySQL()) {
      const [rows] = await mysqlPool.execute(
        'SELECT id FROM users WHERE phone = ? AND user_type = ? LIMIT 1',
        [phone, userType]
      );
      return rows.length > 0;
    } else if (usersDb) {
      return !!usersDb.prepare('SELECT id FROM users WHERE phone = ? AND user_type = ?').get(phone, userType);
    } else {
      return memoryUsers.some(u => u.phone === phone && u.user_type === userType);
    }
  },

  // 检查用户名是否存在
  async usernameExists(username) {
    if (useMySQL()) {
      const [rows] = await mysqlPool.execute(
        'SELECT id FROM users WHERE username = ? LIMIT 1',
        [username]
      );
      return rows.length > 0;
    } else if (usersDb) {
      return !!usersDb.prepare('SELECT id FROM users WHERE username = ?').get(username);
    } else {
      return memoryUsers.some(u => u.username === username);
    }
  },

  // 检查企业是否存在（通过信用代码）
  async enterpriseExists(creditCode) {
    if (useMySQL()) {
      const [rows] = await mysqlPool.execute(
        'SELECT id FROM users WHERE credit_code = ? AND user_type = ? LIMIT 1',
        [creditCode, 'enterprise']
      );
      return rows.length > 0;
    } else if (usersDb) {
      return !!usersDb.prepare('SELECT id FROM users WHERE credit_code = ? AND user_type = ?').get(creditCode, 'enterprise');
    } else {
      return memoryUsers.some(u => u.credit_code === creditCode && u.user_type === 'enterprise');
    }
  },

  // 创建用户
  async create(user) {
    if (useMySQL()) {
      await mysqlPool.execute(
        `INSERT INTO users (id, username, phone, password, user_type, institution_type, institution_name, enterprise_name, credit_code, contact_person, industry, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [user.id, user.username, user.phone, user.password, user.user_type, user.institution_type || null, user.institution_name || null, user.enterprise_name || null, user.credit_code || null, user.contact_person || null, user.industry || null, user.create_time, user.update_time]
      );
    } else if (usersDb) {
      usersDb.prepare(`INSERT INTO users (id, username, phone, password, user_type, institution_type, institution_name, credit_code, contact_person, industry, create_time, update_time, local_db_file, cloud_backup_file, sync_status, last_sync_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(user.id, user.username, user.phone, user.password, user.user_type, user.institution_type || '', user.institution_name || '', user.credit_code || '', user.contact_person || '', user.industry || '', user.create_time, user.update_time, user.local_db_file || '', user.cloud_backup_file || '', user.sync_status || 'synced', user.last_sync_time || null);
    } else {
      memoryUsers.push(user);
      console.log('用户数据已保存到内存存储:', user.id, user.phone);
    }
  },

  // 更新用户
  async update(userId, updates) {
    const fields = Object.keys(updates);
    const values = Object.values(updates);

    if (useMySQL()) {
      const setClause = fields.map(f => `${f} = ?`).join(', ');
      await mysqlPool.execute(
        `UPDATE users SET ${setClause} WHERE id = ?`,
        [...values, userId]
      );
    } else if (usersDb) {
      const setClause = fields.map(f => `${f} = ?`).join(', ');
      usersDb.prepare(`UPDATE users SET ${setClause} WHERE id = ?`).run(...values, userId);
    } else {
      const idx = memoryUsers.findIndex(u => u.id === userId);
      if (idx !== -1) {
        memoryUsers[idx] = { ...memoryUsers[idx], ...updates };
      }
    }
  },

  // 获取关联账号
  async getRelatedAccounts(phone) {
    if (useMySQL()) {
      const [rows] = await mysqlPool.execute(
        'SELECT id, username, phone, user_type, institution_name, enterprise_name, credit_code, create_time FROM users WHERE phone = ?',
        [phone]
      );
      return rows;
    } else if (usersDb) {
      return usersDb.prepare('SELECT id, username, phone, user_type, institution_name, credit_code, create_time FROM users WHERE phone = ?').all(phone);
    } else {
      return memoryUsers.filter(u => u.phone === phone).map(u => ({
        id: u.id,
        username: u.username,
        phone: u.phone,
        user_type: u.user_type,
        institution_name: u.institution_name,
        credit_code: u.credit_code,
        create_time: u.create_time
      }));
    }
  }
};

module.exports = {
  useMySQL,
  UserDB,
  mysqlPool
};
