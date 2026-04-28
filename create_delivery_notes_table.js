const mysql = require('mysql2/promise');

async function query() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: 'rm-bp1t731ujc98jo9c10o.mysql.rds.aliyuncs.com',
      port: 3306,
      user: 'ram_dingding',
      password: 'h5J5BVEXtrjKVDSxmS4w',
      database: 'rds_dingding'
    });
    
    // 创建delivery_notes表
    await conn.query(`
      CREATE TABLE IF NOT EXISTS delivery_notes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        no VARCHAR(50) NOT NULL UNIQUE,
        customer VARCHAR(100) NOT NULL,
        project_name VARCHAR(100),
        contact VARCHAR(50),
        contact_phone VARCHAR(20),
        address VARCHAR(255),
        remark TEXT,
        date DATE NOT NULL,
        status VARCHAR(20) DEFAULT 'draft',
        user_id VARCHAR(64),
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_no (no),
        INDEX idx_user_id (user_id),
        INDEX idx_date (date)
      )
    `);
    console.log('delivery_notes表已创建');
    
    // 创建delivery_note_items表
    await conn.query(`
      CREATE TABLE IF NOT EXISTS delivery_note_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        delivery_note_id INT NOT NULL,
        product_name VARCHAR(100),
        model VARCHAR(50),
        length VARCHAR(20),
        wattage VARCHAR(20),
        brightness VARCHAR(20),
        sensor VARCHAR(20),
        quantity DECIMAL(10,2) DEFAULT 0,
        unit VARCHAR(10) DEFAULT '个',
        price DECIMAL(10,2) DEFAULT 0,
        subtotal DECIMAL(10,2) DEFAULT 0,
        FOREIGN KEY (delivery_note_id) REFERENCES delivery_notes(id) ON DELETE CASCADE
      )
    `);
    console.log('delivery_note_items表已创建');
    
    await conn.end();
  } catch (e) {
    console.log('Error:', e.message);
    if (conn) await conn.end();
  }
}

query();
