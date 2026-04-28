// 检查企业用户kola并添加送货单记录（修复用户ID问题）
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

    // 检查所有kola用户
    console.log('\n检查所有kola用户...');
    const [users] = await conn.execute(
      'SELECT * FROM users WHERE user_type = ? AND (username LIKE ? OR enterprise_name LIKE ?)',
      ['enterprise', '%kola%', '%kola%']
    );

    console.log(`找到 ${users.length} 个kola用户:`);
    users.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id}, 用户名: ${user.username}, 企业名称: ${user.enterprise_name}`);
    });

    // 使用第一个kola用户
    let userId;
    if (users.length > 0) {
      userId = users[0].id;
      console.log('\n使用第一个kola用户:', userId);
    } else {
      // 创建企业用户kola
      console.log('\n企业用户kola不存在，正在创建...');
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
    }

    // 检查送货单是否已存在
    console.log('\n检查送货单是否已存在...');
    const [existingOrders] = await conn.execute(
      'SELECT * FROM delivery_orders WHERE order_no = ?',
      [deliveryData.orderNo]
    );

    if (existingOrders.length > 0) {
      console.log('送货单已存在，更新用户ID...');
      // 更新现有送货单的用户ID
      const [updateResult] = await conn.execute(
        'UPDATE delivery_orders SET user_id = ? WHERE order_no = ?',
        [userId, deliveryData.orderNo]
      );
      console.log('更新结果:', updateResult);
    } else {
      // 添加新的送货单
      console.log('添加新送货单...');
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

      // 添加送货单明细
      console.log('添加送货单明细...');
      for (const item of deliveryData.items) {
        await conn.execute(
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
      }
      console.log('送货单明细添加成功');
    }

    // 验证最终结果
    console.log('\n=== 最终验证 ===');
    const [finalOrders] = await conn.execute(
      'SELECT * FROM delivery_orders WHERE user_id = ?',
      [userId]
    );
    console.log(`企业用户 ${userId} 的送货单数量:`, finalOrders.length);
    
    if (finalOrders.length > 0) {
      const order = finalOrders[0];
      console.log('\n送货单详情:');
      console.log('- 订单号:', order.order_no);
      console.log('- 客户名称:', order.customer_name);
      console.log('- 联系电话:', order.customer_phone);
      console.log('- 送货地址:', order.customer_address);
      console.log('- 送货日期:', order.delivery_date);
      console.log('- 总金额:', order.total_amount);
      console.log('- 状态:', order.status);
      console.log('- 用户ID:', order.user_id);

      // 检查明细
      const [items] = await conn.execute(
        'SELECT * FROM delivery_items WHERE delivery_id = ?',
        [order.id]
      );
      console.log('\n送货单明细数量:', items.length);
      items.forEach((item, index) => {
        console.log(`${index + 1}. 商品: ${item.product_name}`);
        console.log(`   数量: ${item.quantity}, 单价: ${item.unit_price}, 金额: ${item.amount}`);
      });
    }

    console.log('\n✅ 操作完成！');

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