const mysql = require('mysql2/promise');

async function checkDeliveryOrders() {
  const conn = await mysql.createConnection({
    host: 'rm-bp1t731ujc98jo9c10o.mysql.rds.aliyuncs.com',
    port: 3306,
    database: 'rds_dingding',
    user: 'ram_dingding',
    password: 'h5J5BVEXtrjKVDSxmS4w'
  });

  try {
    console.log('=== 检查数据库中的送货单 ===\n');

    const [orders] = await conn.query('SELECT id, order_no, user_id, customer_name FROM delivery_orders ORDER BY create_time DESC');
    
    console.log('数据库中的送货单:');
    orders.forEach(order => {
      console.log(`ID: ${order.id}, 订单号: ${order.order_no}, 用户ID: '${order.user_id}', 客户: ${order.customer_name}`);
    });

    console.log(`\n共 ${orders.length} 条送货单`);

  } catch (error) {
    console.error('查询失败:', error.message);
  } finally {
    await conn.end();
  }
}

checkDeliveryOrders();