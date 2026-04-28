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
    
    // 模拟服务器代码的查询
    const userId = 'USER_1776900041357';
    let query = 'SELECT * FROM delivery_notes';
    let params = [];
    
    if (userId) {
      query += ' WHERE user_id = ?';
      params.push(userId);
    }
    
    query += ' ORDER BY date DESC';
    
    const [notes] = await conn.query(query, params);
    console.log('数据库查询结果 (节点直接执行):');
    notes.forEach(n => {
      console.log(`  id=${n.id}, no=${n.no}, contact='${n.contact}'`);
    });
    
    await conn.end();
  } catch (e) {
    console.log('Error:', e.message);
    if (conn) await conn.end();
  }
}

test();
