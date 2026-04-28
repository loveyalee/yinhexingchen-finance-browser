const mysql = require('mysql2/promise');

async function checkDeliveryOrders() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: 'rm-bp1t731ujc98jo9c10o.mysql.rds.aliyuncs.com',
      port: 3306,
      user: 'ram_dingding',
      password: 'h5J5BVEXtrjKVDSxmS4w',
      database: 'rds_dingding'
    });
    
    // 查看delivery_orders原始数据
    const [orders] = await conn.query('SELECT * FROM delivery_orders');
    console.log('delivery_orders 原始数据:');
    orders.forEach(o => {
      console.log(`  ${o.order_no}: contact_name='${o.contact_name}', contact='${o.contact}', contact_phone='${o.customer_phone}'`);
    });
    
    // 查看delivery_notes当前数据
    const [notes] = await conn.query('SELECT * FROM delivery_notes');
    console.log('\ndelivery_notes 当前数据:');
    notes.forEach(n => {
      console.log(`  ${n.no}: contact='${n.contact}', contact_phone='${n.contact_phone}'`);
    });
    
    await conn.end();
  } catch (e) {
    console.log('Error:', e.message);
    if (conn) await conn.end();
  }
}

checkDeliveryOrders();
