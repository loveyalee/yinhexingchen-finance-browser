const mysql = require('mysql2/promise');

async function check() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: 'rm-bp1t731ujc98jo9c10o.mysql.rds.aliyuncs.com',
      port: 3306,
      user: 'ram_dingding',
      password: 'h5J5BVEXtrjKVDSxmS4w',
      database: 'rds_dingding'
    });
    
    // 查看delivery_note_items表结构
    const [cols] = await conn.query('DESCRIBE delivery_note_items');
    console.log('delivery_note_items 表结构:');
    cols.forEach(c => console.log(`  ${c.Field}: ${c.Type}`));
    
    // 查看delivery_notes表结构
    const [cols2] = await conn.query('DESCRIBE delivery_notes');
    console.log('\ndelivery_notes 表结构:');
    cols2.forEach(c => console.log(`  ${c.Field}: ${c.Type}`));
    
    await conn.end();
  } catch (e) {
    console.log('Error:', e.message);
    if (conn) await conn.end();
  }
}

check();
