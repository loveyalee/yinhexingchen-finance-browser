// 清理重复的送货单并重新添加正确的送货单
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

// 正确的送货单数据
const correctDeliveryData = {
  no: 'SHD20260414514',
  customer: '长沙市长腾物业管理有限公司望城分公司',
  contact: '游葵',
  contact_phone: '18975152694',
  address: '长沙市望城经济技术开发区同心路与马桥河路交汇处东北角金星珑湾',
  date: '2026-04-14',
  status: '待送达',
  remark: '',
  items: JSON.stringify([
    {
      productName: '灯管',
      model: 'T8',
      length: '1.2m',
      wattage: '5W',
      singleDouble: '单亮',
      induction: '雷达感应',
      quantity: 120,
      unit: '支',
      unitPrice: 17.05,
      amount: 2046.00
    }
  ]),
  user_id: 'USER_1776900041357'
};

async function main() {
  let conn;
  try {
    console.log('=== 清理并重新添加送货单 ===\n');
    
    // 连接数据库
    conn = await mysql.createConnection(mysqlConfig);
    console.log('✅ 数据库连接成功');

    // 1. 清理重复的送货单
    console.log('1. 清理重复的送货单...');
    const [deleteResult] = await conn.execute(
      'DELETE FROM delivery_orders WHERE order_no = ?',
      [correctDeliveryData.no]
    );
    console.log(`✅ 已删除 ${deleteResult.affectedRows} 条重复记录`);

    // 2. 清理相关的送货单明细
    console.log('2. 清理相关的送货单明细...');
    await conn.execute('DELETE FROM delivery_items WHERE delivery_id IN (SELECT id FROM delivery_orders WHERE order_no = ?)', [correctDeliveryData.no]);
    console.log('✅ 已清理相关明细');

    // 3. 重新添加正确的送货单
    console.log('3. 重新添加正确的送货单...');
    const [orderResult] = await conn.execute(
      `INSERT INTO delivery_orders (
        order_no, customer_name, contact, contact_phone, date, status, address, remark, items, user_id, create_time, update_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        correctDeliveryData.no,
        correctDeliveryData.customer,
        correctDeliveryData.contact,
        correctDeliveryData.contact_phone,
        correctDeliveryData.date,
        correctDeliveryData.status,
        correctDeliveryData.address,
        correctDeliveryData.remark,
        correctDeliveryData.items,
        correctDeliveryData.user_id,
        new Date(),
        new Date()
      ]
    );
    
    const deliveryId = orderResult.insertId;
    console.log(`✅ 送货单添加成功，ID: ${deliveryId}`);

    // 4. 验证结果
    console.log('\n4. 验证结果...');
    const [orders] = await conn.execute(
      'SELECT * FROM delivery_orders WHERE user_id = ?',
      [correctDeliveryData.user_id]
    );
    
    console.log(`✅ 企业用户 ${correctDeliveryData.user_id} 的送货单数量: ${orders.length}`);
    
    orders.forEach((order, index) => {
      console.log(`\n送货单 ${index + 1}:`);
      console.log(`- 单号: ${order.order_no}`);
      console.log(`- 客户: ${order.customer_name}`);
      console.log(`- 联系人: ${order.contact}`);
      console.log(`- 电话: ${order.contact_phone}`);
      console.log(`- 地址: ${order.address}`);
      console.log(`- 日期: ${order.date}`);
      console.log(`- 状态: ${order.status}`);
      console.log(`- 金额: ${JSON.parse(order.items || '[]').reduce((sum, item) => sum + item.amount, 0)}`);
    });

    console.log('\n✅ 操作完成！送货单已清理并重新添加');

  } catch (error) {
    console.error('❌ 操作失败:', error.message);
    console.error('错误堆栈:', error.stack);
  } finally {
    if (conn) {
      await conn.end();
      console.log('\n数据库连接已关闭');
    }
  }
}

main();