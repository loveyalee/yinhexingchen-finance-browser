/**
 * 查看数据库中的送货单数据
 */

const mysql = require('mysql2/promise');

async function listDeliveryOrders() {
  const connection = await mysql.createConnection({
    host: 'rm-bp1t731ujc98jo9c10o.mysql.rds.aliyuncs.com',
    user: 'ram_dingding',
    password: 'h5J5BVEXtrjKVDSxmS4w',
    database: 'rds_dingding'
  });

  try {
    console.log('=== 所有送货单 ===');
    const [orders] = await connection.execute(
      'SELECT id, order_no, customer_name, user_id, create_time FROM delivery_orders ORDER BY create_time DESC LIMIT 20'
    );

    if (orders.length === 0) {
      console.log('数据库中没有任何送货单');
    } else {
      console.log(`共有 ${orders.length} 条送货单:`);
      orders.forEach(order => {
        console.log(`  - ID: ${order.id}, 单号: ${order.order_no}, 客户: ${order.customer_name}, 用户ID: ${order.user_id}`);
      });
    }

    console.log('\n=== 所有用户 ===');
    const [users] = await connection.execute(
      'SELECT id, username, phone FROM users LIMIT 20'
    );
    users.forEach(user => {
      console.log(`  - ID: ${user.id}, 用户名: ${user.username}, 手机: ${user.phone}`);
    });

  } catch (error) {
    console.error('操作失败:', error);
  } finally {
    await connection.end();
  }
}

listDeliveryOrders();
