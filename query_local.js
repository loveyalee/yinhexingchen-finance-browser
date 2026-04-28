const mysql = require('mysql2/promise');

async function query() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: '127.0.0.1',
      user: 'yinhexingchen',
      password: 'Yhx@123456',
      database: 'yinhexingchen'
    });
    
    const [rows] = await conn.query(`
      SELECT id, no, customer, project_name, contact, contact_phone 
      FROM delivery_notes 
      WHERE (project_name IS NOT NULL AND project_name != '' AND project_name != '-')
         OR (contact IS NOT NULL AND contact != '')
      LIMIT 50
    `);
    
    console.log(JSON.stringify(rows, null, 2));
    
    await conn.end();
  } catch (e) {
    console.log('Error:', e.message);
    if (conn) await conn.end();
  }
}

query();
