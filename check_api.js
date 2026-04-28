const mysql = require('mysql2/promise');

async function checkAPI() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: 'rm-bp1t731ujc98jo9c10o.mysql.rds.aliyuncs.com',
      port: 3306,
      user: 'ram_dingding',
      password: 'h5J5BVEXtrjKVDSxmS4w',
      database: 'rds_dingding'
    });
    
    const [notes] = await conn.query('SELECT * FROM delivery_notes ORDER BY date DESC LIMIT 3');
    console.log(JSON.stringify(notes, null, 2));
    
    await conn.end();
  } catch (e) {
    console.log('Error:', e.message);
    if (conn) await conn.end();
  }
}

checkAPI();
