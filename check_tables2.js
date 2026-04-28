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
    
    // 检查delivery_note_items表是否有no字段
    const [cols] = await conn.query('DESCRIBE delivery_note_items');
    console.log('delivery_note_items columns:', cols.map(c => c.Field).join(', '));
    
    // 检查是否有no字段的记录
    const [itemsWithNo] = await conn.query('SELECT * FROM delivery_note_items WHERE no IS NOT NULL LIMIT 3');
    console.log('\ndelivery_note_items with no:', itemsWithNo.length);
    
    // 检查所有表
    const [tables] = await conn.query('SHOW TABLES');
    console.log('\nAll tables:', tables.map(t => Object.values(t)[0]).join(', '));
    
    // 查询所有包含no字段的表
    for (const t of tables) {
      const tableName = Object.values(t)[0];
      try {
        const [cols2] = await conn.query(`DESCRIBE ${tableName}`);
        const hasNo = cols2.some(c => c.Field === 'no' || c.Field === 'order_no');
        if (hasNo) {
          const [cnt] = await conn.query(`SELECT COUNT(*) as cnt FROM ${tableName}`);
          console.log(`\n${tableName}: ${cnt[0].cnt} rows`);
          const [sample] = await conn.query(`SELECT * FROM ${tableName} LIMIT 1`);
          console.log('Sample:', JSON.stringify(sample[0]));
        }
      } catch (e) {}
    }
    
    await conn.end();
  } catch (e) {
    console.log('Error:', e.message);
    if (conn) await conn.end();
  }
}

check();
