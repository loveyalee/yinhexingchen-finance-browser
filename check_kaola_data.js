// 检查kaola用户的ID和送货单数据
const mysql = require('mysql2/promise');

// 数据库配置
const mysqlConfig = {
  host: 'rm-bp1t731ujc98jo9c10o.mysql.rds.aliyuncs.com',
  port: 3306,
  database: 'rds_dingding',
  user: 'ram_dingding',
  password: 'h5J5BVEXtrjKVDSxmS4w',
  charset: 'utf8mb4',
  timezone: '+08:00'
};

async function main() {
  let conn;
  try {
    console.log('正在连接阿里云RDS数据库...');
    conn = await mysql.createConnection(mysqlConfig);
    console.log('数据库连接成功！\n');

    // 检查所有企业用户
    console.log('=== 所有企业用户 ===');
    const [enterpriseUsers] = await conn.execute(
      'SELECT * FROM users WHERE user_type = ?',
      ['enterprise']
    );
    enterpriseUsers.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}`);
      console.log(`   用户名: ${user.username}`);
      console.log(`   企业名称: ${user.enterprise_name}`);
      console.log(`   手机号: ${user.phone}`);
      console.log(`   创建时间: ${user.create_time}`);
      console.log('');
    });

    // 检查所有送货单
    console.log('=== 所有送货单 ===');
    const [allOrders] = await conn.execute('SELECT * FROM delivery_orders');
    console.log(`共 ${allOrders.length} 条送货单:`);
    allOrders.forEach((order, index) => {
      console.log(`${index + 1}. 订单号: ${order.order_no}`);
      console.log(`   用户ID: ${order.user_id}`);
      console.log(`   客户: ${order.customer_name}`);
      console.log(`   金额: ${order.total_amount}`);
      console.log(`   创建时间: ${order.create_time}`);
      console.log('');
    });

    // 特别检查kola用户的送货单
    console.log('=== 检查kola用户的送货单 ===');
    const [kolaOrders] = await conn.execute(
      'SELECT * FROM delivery_orders WHERE user_id IN (SELECT id FROM users WHERE username = ? OR enterprise_name LIKE ?)',
      ['kola', '%kola%']
    );
    console.log(`kola用户的送货单数量: ${kolaOrders.length}`);
    kolaOrders.forEach((order, index) => {
      console.log(`${index + 1}. 订单号: ${order.order_no}`);
      console.log(`   用户ID: ${order.user_id}`);
      console.log(`   客户: ${order.customer_name}`);
      console.log('');
    });

    // 检查送货单明细
    console.log('=== 送货单明细 ===');
    const [allItems] = await conn.execute('SELECT * FROM delivery_items');
    console.log(`共 ${allItems.length} 条明细`);
    allItems.forEach((item, index) => {
      console.log(`${index + 1}. 送货单ID: ${item.delivery_id}, 商品: ${item.product_name}, 数量: ${item.quantity}`);
    });

  } catch (error) {
    console.error('操作失败:', error.message);
  } finally {
    if (conn) {
      await conn.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

main();