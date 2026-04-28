/**
 * 搜索含有特定关键词的送货单
 */

const mysql = require('mysql2/promise');

async function searchDeliveryOrders() {
  const connection = await mysql.createConnection({
    host: 'rm-bp1t731ujc98jo9c10o.mysql.rds.aliyuncs.com',
    user: 'ram_dingding',
    password: 'h5J5BVEXtrjKVDSxmS4w',
    database: 'rds_dingding'
  });

  try {
    // 搜索多个关键词
    const keywords = ['长房', '长腾', '物业', '长沙'];

    for (const keyword of keywords) {
      console.log(`\n=== 搜索含"${keyword}"的送货单 ===`);
      const [orders] = await connection.execute(
        'SELECT id, order_no, customer_name, user_id FROM delivery_orders WHERE customer_name LIKE ?',
        [`%${keyword}%`]
      );

      if (orders.length === 0) {
        console.log(`未找到含"${keyword}"的送货单`);
      } else {
        console.log(`找到 ${orders.length} 条:`);
        orders.forEach(order => {
          console.log(`  - ID: ${order.id}, 单号: ${order.order_no}, 客户: ${order.customer_name}, 用户ID: ${order.user_id}`);
        });
      }
    }

    // 查看kaola用户的所有送货单
    console.log('\n=== kaola用户的所有送货单 ===');
    const [kaolaOrders] = await connection.execute(
      'SELECT id, order_no, customer_name, user_id FROM delivery_orders WHERE user_id = ?',
      ['USER_1776900041357']
    );
    console.log(`kaola用户有 ${kaolaOrders.length} 条送货单`);
    kaolaOrders.forEach(order => {
      console.log(`  - ID: ${order.id}, 单号: ${order.order_no}, 客户: ${order.customer_name}`);
    });

  } catch (error) {
    console.error('操作失败:', error);
  } finally {
    await connection.end();
  }
}

searchDeliveryOrders();
