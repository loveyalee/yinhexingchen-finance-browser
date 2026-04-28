// 补充阿里云数据库中送货单的联系人字段
const mysql = require('mysql2/promise');

const mysqlConfig = {
  host: 'rm-bp1t731ujc98jo9c10o.mysql.rds.aliyuncs.com',
  port: 3306,
  database: 'rds_dingding',
  user: 'ram_dingding',
  password: 'h5J5BVEXtrjKVDSxmS4w',
  charset: 'utf8mb4',
};

async function main() {
  const conn = await mysql.createConnection(mysqlConfig);

  // 查询所有送货单及其联系人信息
  const [orders] = await conn.execute(`
    SELECT id, order_no, customer_name, contact, customer_phone, customer_address, project
    FROM delivery_orders
    ORDER BY id DESC
  `);

  console.log('当前送货单联系人数据:');
  for (const o of orders) {
    console.log(`  ID=${o.id} 单号=${o.order_no} 客户=${o.customer_name}`);
    console.log(`    contact="${o.contact}" phone="${o.customer_phone}" address="${o.customer_address}" project="${o.project}"`);
  }

  await conn.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
