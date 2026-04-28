// 批量补录送货单到kaola用户的阿里云数据库
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

// 批量送货单数据
const deliveryOrders = [
  {
    no: 'SHD20260414514',
    customer: '长沙市长腾物业管理有限公司望城分公司',
    contact: '游葵',
    contactPhone: '18975152694',
    address: '长沙市望城经济技术开发区同心路与马桥河路交汇处东北角金星珑湾',
    date: '2026-04-14',
    remark: '',
    totalAmount: 2046.00,
    status: 'pending',
    userId: 'USER_1776900041357', // kaola用户ID
    items: [
      {
        productName: '灯管 T8 1.2m 5W 单亮 雷达感应',
        quantity: 120,
        unitPrice: 17.05,
        amount: 2046.00,
        remark: '型号: T8, 长度: 1.2m, 瓦数: 5W, 单/双亮: 单亮, 感应: 雷达感应, 单位: 支'
      }
    ]
  },
  {
    no: 'SHD20260414762',
    customer: '长沙市长腾物业管理有限公司',
    contact: '甘朝阳',
    contactPhone: '18174433796',
    address: '长沙市芙蓉区浏正街41号',
    date: '2026-04-14',
    remark: '0731-82960210',
    totalAmount: 9119.00,
    status: 'pending',
    userId: 'USER_1776900041357', // kaola用户ID
    items: [
      {
        productName: '灯管 T8 1.2m 2-8W 双亮 雷达感应',
        quantity: 300,
        unitPrice: 25.30,
        amount: 7590.00,
        remark: '型号: T8, 长度: 1.2m, 瓦数: 2-8W, 单/双亮: 双亮, 感应: 雷达感应, 单位: 支'
      },
      {
        productName: '灯管 T8 1.2m 3-10W 双亮 雷达感应',
        quantity: 20,
        unitPrice: 25.30,
        amount: 506.00,
        remark: '型号: T8, 长度: 1.2m, 瓦数: 3-10W, 单/双亮: 双亮, 感应: 雷达感应, 单位: 支'
      },
      {
        productName: '灯管 T8 1.2m 5W 单亮 雷达感应',
        quantity: 60,
        unitPrice: 17.05,
        amount: 1023.00,
        remark: '型号: T8, 长度: 1.2m, 瓦数: 5W, 单/双亮: 单亮, 感应: 雷达感应, 单位: 支'
      }
    ]
  }
];

async function processDeliveryOrder(conn, order) {
  try {
    console.log(`\n处理送货单: ${order.no}`);
    
    // 检查送货单是否已存在
    const [existingOrders] = await conn.execute(
      'SELECT * FROM delivery_orders WHERE order_no = ?',
      [order.no]
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
          order.customer,
          order.contactPhone,
          order.address,
          order.date,
          order.totalAmount,
          order.status,
          order.userId,
          new Date(),
          order.no
        ]
      );
      console.log('✅ 送货单更新成功');
      
      // 获取现有送货单ID
      const deliveryId = existingOrders[0].id;
      
      // 清除旧的商品明细
      await conn.execute('DELETE FROM delivery_items WHERE delivery_id = ?', [deliveryId]);
      console.log('✅ 旧商品明细已清除');
      
      // 添加新的商品明细
      for (const item of order.items) {
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
      // 添加新的送货单
      console.log('3. 添加新的送货单...');
      const [orderResult] = await conn.execute(
        `INSERT INTO delivery_orders (
          order_no, customer_name, customer_phone, customer_address, 
          delivery_date, total_amount, status, user_id, create_time, update_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          order.no,
          order.customer,
          order.contactPhone,
          order.address,
          order.date,
          order.totalAmount,
          order.status,
          order.userId,
          new Date(),
          new Date()
        ]
      );
      
      const deliveryId = orderResult.insertId;
      console.log(`✅ 送货单添加成功，ID: ${deliveryId}`);

      // 添加商品明细
      console.log('4. 添加商品明细...');
      for (const item of order.items) {
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
    
    return true;
  } catch (error) {
    console.error(`❌ 处理送货单 ${order.no} 失败:`, error.message);
    return false;
  }
}

async function main() {
  let conn;
  try {
    console.log('=== 批量补录送货单到阿里云数据库 ===\n');
    
    // 连接数据库
    conn = await mysql.createConnection(mysqlConfig);
    console.log('✅ 数据库连接成功');

    // 处理每个送货单
    let successCount = 0;
    let totalCount = deliveryOrders.length;
    
    for (const order of deliveryOrders) {
      const success = await processDeliveryOrder(conn, order);
      if (success) {
        successCount++;
      }
    }

    // 验证结果
    console.log('\n=== 验证结果 ===');
    const [orders] = await conn.execute(
      'SELECT * FROM delivery_orders WHERE user_id = ?',
      [deliveryOrders[0].userId]
    );
    
    console.log(`✅ 用户 ${deliveryOrders[0].userId} 的送货单数量: ${orders.length}`);
    
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

    console.log(`\n✅ 操作完成！成功补录 ${successCount}/${totalCount} 张送货单`);

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