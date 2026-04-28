const mysql = require('mysql2/promise');

async function test() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: 'rm-bp1t731ujc98jo9c10o.mysql.rds.aliyuncs.com',
      port: 3306,
      user: 'ram_dingding',
      password: 'h5J5BVEXtrjKVDSxmS4w',
      database: 'rds_dingding'
    });
    
    // 直接SELECT * 看所有字段
    const [notes] = await conn.query('SELECT * FROM delivery_notes ORDER BY id');
    console.log('所有字段:');
    notes.forEach(n => {
      console.log(`id=${n.id}, no=${n.no}`);
      console.log(`  contact='${n.contact}', contact_phone='${n.contact_phone}'`);
      console.log(`  Keys:`, Object.keys(n));
    });
    
    await conn.end();
  } catch (e) {
    console.log('Error:', e.message);
    if (conn) await conn.end();
  }
}

test();
