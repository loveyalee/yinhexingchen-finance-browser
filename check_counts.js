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
    
    // 查看所有delivery_orders
    const [orders] = await conn.query('SELECT COUNT(*) as cnt FROM delivery_orders');
    console.log('delivery_orders总数:', orders[0].cnt);
    
    // 查看所有delivery_notes
    const [notes] = await conn.query('SELECT COUNT(*) as cnt FROM delivery_notes');
    console.log('delivery_notes总数:', notes[0].cnt);
    
    // 列出所有有项目或联系人的送货单
    const [allWithProject] = await conn.query(`
      SELECT no, customer, project_name, contact FROM delivery_notes 
      WHERE project_name IS NOT NULL AND project_name != ''
         OR contact IS NOT NULL AND contact != ''
    `);
    console.log('\n有项目或联系人的送货单:');
    console.log(JSON.stringify(allWithProject, null, 2));
    
    await conn.end();
  } catch (e) {
    console.log('Error:', e.message);
    if (conn) await conn.end();
  }
}

query();
