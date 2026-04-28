// 检查数据库表结构并重新添加送货单
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
    console.log('=== 检查数据库表结构 ===\n');
    
    // 连接数据库
    conn = await mysql.createConnection(mysqlConfig);
    console.log('✅ 数据库连接成功');

    // 1. 检查delivery_orders表结构
    console.log('1. 检查delivery_orders表结构...');
    const [columns] = await conn.execute(
      'DESCRIBE delivery_orders'
    );
    
    console.log('表结构:');
    columns.forEach(col => {
      console.log(`- ${col.Field} (${col.Type})`);
    });

    // 2. 重新添加送货单（使用正确的字段名）
    console.log('\n2. 重新添加送货单...');
    const [orderResult] = await conn.execute(
      `INSERT INTO delivery_orders (
        order_no, customer_name, customer_phone, customer_address,
        delivery_date, project, total_amount, status, user_id, create_time, update_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'SHD20260414514',
        '长沙市长腾物业管理有限公司望城分公司',
        '18975152694',
        '长沙市望城经济技术开发区同心路与马桥河路交汇处东北角金星珑湾',
        '2026-04-14',
        '云西府住宅',
        2046.00,
        'pending',
        'USER_1776900041357',
        new Date(),
        new Date()
      ]
    );
    
    const deliveryId = orderResult.insertId;
    console.log(`✅ 送货单添加成功，ID: ${deliveryId}`);

    // 3. 添加送货单明细
    console.log('3. 添加送货单明细...');
    const [itemResult] = await conn.execute(
      `INSERT INTO delivery_items (
        delivery_id, product_name, model, brightness, sensor_mode, quantity, unit, unit_price, amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        deliveryId,
        '灯管 T8 1.2m 5W 单亮 雷达感应',
        'T8',
        '单亮',
        '雷达感应',
        120,
        '支',
        17.05,
        2046.00
      ]
    );
    console.log(`✅ 送货单明细添加成功，ID: ${itemResult.insertId}`);

    // 4. 验证结果
    console.log('\n4. 验证结果...');
    const [orders] = await conn.execute(
      'SELECT * FROM delivery_orders WHERE user_id = ?',
      ['USER_1776900041357']
    );
    
    console.log(`✅ 企业用户 USER_1776900041357 的送货单数量: ${orders.length}`);
    
    orders.forEach((order, index) => {
      console.log(`\n送货单 ${index + 1}:`);
      console.log(`- 单号: ${order.order_no}`);
      console.log(`- 客户: ${order.customer_name}`);
      console.log(`- 电话: ${order.customer_phone}`);
      console.log(`- 地址: ${order.customer_address}`);
      console.log(`- 日期: ${order.delivery_date}`);
      console.log(`- 金额: ${order.total_amount}`);
      console.log(`- 状态: ${order.status}`);
    });

    console.log('\n✅ 操作完成！送货单已添加成功');

  } catch (error) {
    console.error('❌ 操作失败:', error.message);
  } finally {
    if (conn) {
      await conn.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

main();