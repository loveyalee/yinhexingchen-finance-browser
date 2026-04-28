const mysql = require('mysql2/promise');

async function query() {
  let conn;
  try {
    // 连接腾讯云本地MySQL
    conn = await mysql.createConnection({
      host: 'rm-bp1t731ujc98jo9c10o.mysql.rds.aliyuncs.com',
      port: 3306,
      user: 'ram_dingding',
      password: 'h5J5BVEXtrjKVDSxmS4w',
      database: 'rds_dingding'
    });
    
    // 先查询delivery_notes表结构
    const [cols] = await conn.query('DESCRIBE delivery_notes');
    console.log('delivery_notes columns:');
    cols.forEach(c => console.log(`  ${c.Field}: ${c.Type}`));
    
    // 查询当前送货单数量
    const [count] = await conn.query('SELECT COUNT(*) as cnt FROM delivery_notes');
    console.log('\n送货单总数:', count[0].cnt);
    
    await conn.end();
  } catch (e) {
    console.log('Error:', e.message);
    if (conn) await conn.end();
  }
}

query();
