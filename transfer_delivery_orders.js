/**
 * 转移送货单脚本
 * 将客户名称含有"长房"的送货单转移到kaola用户
 */

const mysql = require('mysql2/promise');

async function transferDeliveryOrders() {
  const connection = await mysql.createConnection({
    host: 'rm-bp1t731ujc98jo9c10o.mysql.rds.aliyuncs.com',
    user: 'ram_dingding',
    password: 'h5J5BVEXtrjKVDSxmS4w',
    database: 'rds_dingding'
  });

  try {
    console.log('=== 步骤1: 查找kaola用户ID ===');
    const [users] = await connection.execute(
      'SELECT id, username, phone FROM users WHERE username = ? OR phone = ?',
      ['kaola', 'kaola']
    );

    if (users.length === 0) {
      console.log('未找到kaola用户');
      return;
    }

    const kaolaUser = users[0];
    console.log('找到kaola用户:', kaolaUser);
    const kaolaUserId = kaolaUser.id;

    console.log('\n=== 步骤2: 查找含有"长房"的送货单 ===');
    const [orders] = await connection.execute(
      'SELECT id, order_no, customer_name, user_id FROM delivery_orders WHERE customer_name LIKE ?',
      ['%长房%']
    );

    if (orders.length === 0) {
      console.log('未找到含有"长房"的送货单');
      return;
    }

    console.log(`找到 ${orders.length} 条含有"长房"的送货单:`);
    orders.forEach(order => {
      console.log(`  - ID: ${order.id}, 单号: ${order.order_no}, 客户: ${order.customer_name}, 当前用户ID: ${order.user_id}`);
    });

    console.log('\n=== 步骤3: 转移送货单到kaola用户 ===');
    const orderIds = orders.map(o => o.id);
    const placeholders = orderIds.map(() => '?').join(',');

    const [result] = await connection.execute(
      `UPDATE delivery_orders SET user_id = ? WHERE id IN (${placeholders})`,
      [kaolaUserId, ...orderIds]
    );

    console.log(`成功转移 ${result.affectedRows} 条送货单到kaola用户`);

    console.log('\n=== 步骤4: 验证转移结果 ===');
    const [verifyOrders] = await connection.execute(
      'SELECT id, order_no, customer_name, user_id FROM delivery_orders WHERE id IN (' + placeholders + ')',
      orderIds
    );

    console.log('转移后的送货单状态:');
    verifyOrders.forEach(order => {
      console.log(`  - ID: ${order.id}, 单号: ${order.order_no}, 客户: ${order.customer_name}, 用户ID: ${order.user_id}`);
    });

    console.log('\n=== 转移完成 ===');

  } catch (error) {
    console.error('操作失败:', error);
  } finally {
    await connection.end();
  }
}

transferDeliveryOrders();
