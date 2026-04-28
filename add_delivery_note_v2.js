// 检查企业用户kola并添加送货单记录（带详细日志）
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
  orderNo: 'SHD20260414514',
  customerName: '长沙市长腾物业管理有限公司望城分公司',
  contact: '游葵',
  contactPhone: '18975152694',
  address: '长沙市望城经济技术开发区同心路与马桥河路交汇处东北角金星珑湾',
  deliveryDate: '2026-04-14',
  totalAmount: 2046.00,
  items: [
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
  ]
};

async function main() {
  let conn;
  try {
    // 连接数据库
    console.log('正在连接阿里云RDS数据库...');
    conn = await mysql.createConnection(mysqlConfig);
    console.log('数据库连接成功！');

    // 检查数据库中的表
    console.log('\n检查数据库表结构...');
    const [tables] = await conn.execute(
      "SHOW TABLES LIKE 'delivery_%'"
    );
    console.log('找到的表:', tables.map(t => Object.values(t)[0]));

    // 检查企业用户kola是否存在
    console.log('\n检查企业用户kola...');
    const [users] = await conn.execute(
      'SELECT * FROM users WHERE user_type = ? AND (username = ? OR enterprise_name LIKE ?)',
      ['enterprise', 'kola', '%kola%']
    );

    let userId;
    if (users.length === 0) {
      // 创建企业用户kola
      console.log('企业用户kola不存在，正在创建...');
      const [result] = await conn.execute(
        `INSERT INTO users (
          id, username, phone, password, user_type, enterprise_name, 
          contact_person, industry, create_time, update_time
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'user_kola_' + Date.now(),
          'kola',
          '13800138000',
          'encrypted_password',
          'enterprise',
          'Kola企业',
          'Kola管理员',
          '科技',
          new Date(),
          new Date()
        ]
      );
      userId = 'user_kola_' + Date.now();
      console.log('企业用户kola创建成功，ID:', userId);
    } else {
      userId = users[0].id;
      console.log('企业用户kola已存在，ID:', userId);
    }

    // 检查送货单是否已存在
    console.log('\n检查送货单是否已存在...');
    const [existingOrders] = await conn.execute(
      'SELECT * FROM delivery_orders WHERE order_no = ?',
      [deliveryData.orderNo]
    );

    if (existingOrders.length > 0) {
      console.log('送货单已存在，无需重复添加');
      console.log('现有送货单:', existingOrders[0]);
    } else {
      // 添加送货单（不使用事务，直接执行）
      console.log('添加送货单...');
      try {
        const [orderResult] = await conn.execute(
          `INSERT INTO delivery_orders (
            order_no, customer_name, customer_phone, customer_address, 
            delivery_date, total_amount, status, user_id, create_time, update_time
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            deliveryData.orderNo,
            deliveryData.customerName,
            deliveryData.contactPhone,
            deliveryData.address,
            deliveryData.deliveryDate,
            deliveryData.totalAmount,
            'pending',
            userId,
            new Date(),
            new Date()
          ]
        );
        
        const deliveryId = orderResult.insertId;
        console.log('送货单添加成功，ID:', deliveryId);
        console.log('插入结果:', orderResult);

        // 添加送货单明细
        console.log('添加送货单明细...');
        for (const item of deliveryData.items) {
          const [itemResult] = await conn.execute(
            `INSERT INTO delivery_items (
              delivery_id, product_name, quantity, unit_price, amount, remark
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              deliveryId,
              `${item.productName} ${item.model} ${item.length} ${item.wattage} ${item.singleDouble} ${item.induction}`,
              item.quantity,
              item.unitPrice,
              item.amount,
              `型号: ${item.model}, 长度: ${item.length}, 瓦数: ${item.wattage}, 单/双亮: ${item.singleDouble}, 感应: ${item.induction}, 单位: ${item.unit}`
            ]
          );
          console.log('明细添加结果:', itemResult);
        }
        console.log('送货单明细添加成功');

        console.log('\n✅ 送货单添加完成！');
        console.log('订单号:', deliveryData.orderNo);
        console.log('客户名称:', deliveryData.customerName);
        console.log('总金额:', deliveryData.totalAmount);
        console.log('用户ID:', userId);

      } catch (error) {
        console.error('添加送货单失败:', error.message);
        console.error('错误堆栈:', error.stack);
      }
    }

    // 验证添加结果
    console.log('\n验证添加结果...');
    const [allOrders] = await conn.execute(
      'SELECT * FROM delivery_orders WHERE user_id = ?',
      [userId]
    );
    console.log(`用户 ${userId} 的送货单数量:`, allOrders.length);
    allOrders.forEach(order => {
      console.log('订单:', order.order_no, 'ID:', order.id);
    });

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