/**
 * 直接连接MySQL添加客户信息
 */

const mysql = require('mysql2/promise');

async function addCustomersToMySQL() {
  const connection = await mysql.createConnection({
    host: 'rm-bp1t731ujc98jo9c10o.mysql.rds.aliyuncs.com',
    user: 'ram_dingding',
    password: 'h5J5BVEXtrjKVDSxmS4w',
    database: 'rds_dingding'
  });

  try {
    console.log('=== 连接MySQL成功 ===');

    // 检查customers表是否存在
    const [tables] = await connection.execute(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'rds_dingding' AND TABLE_NAME = 'customers'"
    );

    if (tables.length === 0) {
      console.log('customers表不存在，正在创建...');
      await connection.execute(`
        CREATE TABLE customers (
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
      console.log('customers表创建成功');
    } else {
      console.log('customers表已存在');
    }

    // 添加客户信息
    const KAOLA_USER_ID = 'USER_1776900041357';
    const customers = [
      {
        name: '长沙市长腾物业管理有限公司',
        contact: '',
        phone: '18174433796',
        address: '长沙市芙蓉区浏正街41号'
      },
      {
        name: '长沙市长腾物业管理有限公司望城分公司',
        contact: '',
        phone: '18975152694',
        address: '长沙市望城经济技术开发区同心路与马桥河路交汇处东北角金星珑湾'
      }
    ];

    for (const customer of customers) {
      // 检查是否已存在
      const [existing] = await connection.execute(
        'SELECT id FROM customers WHERE name = ? AND user_id = ?',
        [customer.name, KAOLA_USER_ID]
      );

      if (existing.length > 0) {
        console.log('客户已存在:', customer.name, 'ID:', existing[0].id);
        continue;
      }

      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
      const [result] = await connection.execute(
        'INSERT INTO customers (name, contact, phone, address, user_id, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [customer.name, customer.contact, customer.phone, customer.address, KAOLA_USER_ID, now, now]
      );
      console.log('添加客户成功:', customer.name, 'ID:', result.insertId);
    }

    // 验证数据
    const [allCustomers] = await connection.execute(
      'SELECT * FROM customers WHERE user_id = ?',
      [KAOLA_USER_ID]
    );
    console.log('\nkaola用户的所有客户:');
    allCustomers.forEach(c => {
      console.log(`  - ID: ${c.id}, 名称: ${c.name}, 电话: ${c.phone}`);
    });

  } catch (error) {
    console.error('操作失败:', error);
  } finally {
    await connection.end();
  }
}

addCustomersToMySQL();
