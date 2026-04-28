// 修复送货单用户ID问题 - 把送货单从kola更新到kaola用户
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

    // 获取kaola用户的ID
    console.log('=== 获取kaola用户信息 ===');
    const [kaolaUsers] = await conn.execute(
      'SELECT * FROM users WHERE username = ?',
      ['kaola']
    );

    if (kaolaUsers.length === 0) {
      console.log('找不到kaola用户！');
      return;
    }

    const kaolaUserId = kaolaUsers[0].id;
    console.log('kaola用户信息:');
    console.log('- ID:', kaolaUserId);
    console.log('- 用户名:', kaolaUsers[0].username);
    console.log('- 手机号:', kaolaUsers[0].phone);
    console.log('- 创建时间:', kaolaUsers[0].create_time);

    // 更新送货单的用户ID
    console.log('\n=== 更新送货单用户ID ===');
    const [updateResult] = await conn.execute(
      'UPDATE delivery_orders SET user_id = ? WHERE order_no = ?',
      [kaolaUserId, 'SHD20260414514']
    );
    console.log('更新结果:', updateResult);

    // 验证更新结果
    console.log('\n=== 验证更新结果 ===');
    const [updatedOrders] = await conn.execute(
      'SELECT * FROM delivery_orders WHERE order_no = ?',
      ['SHD20260414514']
    );

    if (updatedOrders.length > 0) {
      const order = updatedOrders[0];
      console.log('更新后的送货单:');
      console.log('- 订单号:', order.order_no);
      console.log('- 用户ID:', order.user_id);
      console.log('- 客户名称:', order.customer_name);
      console.log('- 联系电话:', order.customer_phone);
      console.log('- 送货地址:', order.customer_address);
      console.log('- 送货日期:', order.delivery_date);
      console.log('- 总金额:', order.total_amount);
      console.log('- 状态:', order.status);

      // 验证kaola用户现在能看到这条送货单
      console.log('\n=== 验证kaola用户的送货单 ===');
      const [kaolaOrders] = await conn.execute(
        'SELECT * FROM delivery_orders WHERE user_id = ?',
        [kaolaUserId]
      );
      console.log(`kaola用户(${kaolaUserId})的送货单数量: ${kaolaOrders.length}`);
      kaolaOrders.forEach((o, index) => {
        console.log(`${index + 1}. 订单号: ${o.order_no}, 客户: ${o.customer_name}, 金额: ${o.total_amount}`);
      });
    }

    console.log('\n✅ 送货单用户ID更新完成！');
    console.log('现在kaola用户登录后应该能看到这条送货单了。');

  } catch (error) {
    console.error('操作失败:', error.message);
    console.error('错误堆栈:', error.stack);
  } finally {
    if (conn) {
      await conn.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

main();