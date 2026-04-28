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
    
    // 直接查数据库
    const [rows] = await conn.query('SELECT no, customer, project_name, contact, contact_phone FROM delivery_notes');
    console.log('数据库原始数据:');
    rows.forEach(r => {
      console.log(`  ${r.no}: project_name='${r.project_name}', contact='${r.contact}', contact_phone='${r.contact_phone}'`);
    });
    
    await conn.end();
  } catch (e) {
    console.log('Error:', e.message);
    if (conn) await conn.end();
  }
}

check();
