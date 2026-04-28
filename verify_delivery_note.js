// 验证送货单添加结果
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
    // 连接数据库
    console.log('正在连接阿里云RDS数据库...');
    conn = await mysql.createConnection(mysqlConfig);
    console.log('数据库连接成功！');

    // 检查企业用户kola
    console.log('\n检查企业用户kola...');
    const [users] = await conn.execute(
      'SELECT * FROM users WHERE user_type = ? AND (username = ? OR enterprise_name LIKE ?)',
      ['enterprise', 'kola', '%kola%']
    );

    if (users.length === 0) {
      console.log('企业用户kola不存在');
      return;
    }

    const userId = users[0].id;
    console.log('企业用户kola信息:');
    console.log('- ID:', users[0].id);
    console.log('- 用户名:', users[0].username);
    console.log('- 企业名称:', users[0].enterprise_name);
    console.log('- 联系人:', users[0].contact_person);
    console.log('- 行业:', users[0].industry);

    // 查询送货单
    console.log('\n查询送货单...');
    const [orders] = await conn.execute(
      'SELECT * FROM delivery_orders WHERE user_id = ?',
      [userId]
    );

    console.log(`共找到 ${orders.length} 条送货单记录:`);
    for (const order of orders) {
      console.log('\n送货单详情:');
      console.log('- 订单号:', order.order_no);
      console.log('- 客户名称:', order.customer_name);
      console.log('- 联系电话:', order.customer_phone);
      console.log('- 送货地址:', order.customer_address);
      console.log('- 送货日期:', order.delivery_date);
      console.log('- 总金额:', order.total_amount);
      console.log('- 状态:', order.status);
      console.log('- 创建时间:', order.create_time);

      // 查询送货单明细
      const [items] = await conn.execute(
        'SELECT * FROM delivery_items WHERE delivery_id = ?',
        [order.id]
      );

      console.log('\n送货单明细:');
      items.forEach((item, index) => {
        console.log(`${index + 1}. 商品: ${item.product_name}`);
        console.log(`   数量: ${item.quantity}, 单价: ${item.unit_price}, 金额: ${item.amount}`);
        console.log(`   备注: ${item.remark}`);
      });
    }

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