// 补录送货单到用户考拉的阿里云数据库
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

// 送货单数据
const deliveryData = {
  no: 'SHD20260416196',
  customer: '长沙市长腾物业管理有限公司',
  contact: '甘朝阳',
  contactPhone: '18174433796',
  address: '长沙市芙蓉区浏正街41号',
  date: '2026-04-15',
  remark: '2026年4月云西府住宅',
  totalAmount: 5742.00,
  status: 'pending',
  userId: 'USER_1776900041357' // 考拉用户ID
};

// 商品明细
const items = [
  {
    productName: '灯管 T8 双亮 雷达感应',
    quantity: 200,
    unitPrice: 25.30,
    amount: 5060.00,
    remark: '型号: T8, 单/双亮: 双亮, 感应: 雷达感应, 单位: 支'
  },
  {
    productName: '灯管 T8 单亮 雷达感应',
    quantity: 40,
    unitPrice: 17.05,
    amount: 682.00,
    remark: '型号: T8, 单/双亮: 单亮, 感应: 雷达感应, 单位: 支'
  }
];

async function main() {
  let conn;
  try {
    console.log('=== 补录送货单到阿里云数据库 ===\n');
    
    // 连接数据库
    conn = await mysql.createConnection(mysqlConfig);
    console.log('✅ 数据库连接成功');

    // 1. 检查users表结构
    console.log('1. 检查users表结构...');
    const [columns] = await conn.execute('DESCRIBE users');
    console.log('Users表结构:');
    columns.forEach(col => {
      console.log(`- ${col.Field} (${col.Type})`);
    });

    // 2. 检查送货单是否已存在
    console.log('\n2. 检查送货单是否已存在...');
    const [existingOrders] = await conn.execute(
      'SELECT * FROM delivery_orders WHERE order_no = ?',
      [deliveryData.no]
    );
    
    if (existingOrders.length > 0) {
      console.log('❌ 送货单已存在，更新记录...');
      await conn.execute(
        `UPDATE delivery_orders SET 
          customer_name = ?, 
          customer_phone = ?, 
          customer_address = ?, 
          delivery_date = ?, 
          total_amount = ?, 
          status = ?, 
          user_id = ?, 
          update_time = ? 
        WHERE order_no = ?`,
        [
          deliveryData.customer,
          deliveryData.contactPhone,
          deliveryData.address,
          deliveryData.date,
          deliveryData.totalAmount,
          deliveryData.status,
          deliveryData.userId,
          new Date(),
          deliveryData.no
        ]
      );
      console.log('✅ 送货单更新成功');
      
      // 获取现有送货单ID
      const deliveryId = existingOrders[0].id;
      
      // 清除旧的商品明细
      await conn.execute('DELETE FROM delivery_items WHERE delivery_id = ?', [deliveryId]);
      console.log('✅ 旧商品明细已清除');
      
      // 添加新的商品明细
      for (const item of items) {
        await conn.execute(
          `INSERT INTO delivery_items (
            delivery_id, product_name, quantity, unit_price, amount, remark
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            deliveryId,
            item.productName,
            item.quantity,
            item.unitPrice,
            item.amount,
            item.remark
          ]
        );
      }
      console.log('✅ 新商品明细添加成功');
      
    } else {
      // 3. 添加新的送货单
      console.log('3. 添加新的送货单...');
      const [orderResult] = await conn.execute(
        `INSERT INTO delivery_orders (
          order_no, customer_name, customer_phone, customer_address, 
          delivery_date, total_amount, status, user_id, create_time, update_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          deliveryData.no,
          deliveryData.customer,
          deliveryData.contactPhone,
          deliveryData.address,
          deliveryData.date,
          deliveryData.totalAmount,
          deliveryData.status,
          deliveryData.userId,
          new Date(),
          new Date()
        ]
      );
      
      const deliveryId = orderResult.insertId;
      console.log(`✅ 送货单添加成功，ID: ${deliveryId}`);

      // 4. 添加商品明细
      console.log('4. 添加商品明细...');
      for (const item of items) {
        const [itemResult] = await conn.execute(
          `INSERT INTO delivery_items (
            delivery_id, product_name, quantity, unit_price, amount, remark
          ) VALUES (?, ?, ?, ?, ?, ?)`,
          [
            deliveryId,
            item.productName,
            item.quantity,
            item.unitPrice,
            item.amount,
            item.remark
          ]
        );
        console.log(`✅ 商品明细添加成功，ID: ${itemResult.insertId}`);
      }
    }

    // 5. 验证结果
    console.log('\n5. 验证结果...');
    const [orders] = await conn.execute(
      'SELECT * FROM delivery_orders WHERE user_id = ?',
      [deliveryData.userId]
    );
    
    console.log(`✅ 用户 ${deliveryData.userId} 的送货单数量: ${orders.length}`);
    
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

    console.log('\n✅ 操作完成！送货单已补录到阿里云数据库');

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