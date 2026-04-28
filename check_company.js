const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: '111.230.36.222',
    user: 'yinhe_user',
    password: 'yinhe_pass_2024',
    database: 'yinhe_db',
    charset: 'utf8mb4'
  });

  const [rows] = await conn.query(
    'SELECT id, name, is_demo, demo_expires_at, created_at FROM companies ORDER BY created_at DESC LIMIT 30'
  );

  console.log('id\tname\tis_demo\tdemo_expires_at\tcreated_at');
  for (const r of rows) {
    console.log(`${r.id}\t${r.name}\t${r.is_demo}\t${r.demo_expires_at}\t${r.created_at}`);
  }

  await conn.end();
}

main().catch(console.error);
