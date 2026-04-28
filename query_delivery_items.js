// 在阿里云数据库添加 contact 字段并查询送货单明细
const mysql = require('mysql2/promise');

const mysqlConfig = {
  host: 'rm-bp1t731ujc98jo9c10o.mysql.rds.aliyuncs.com',
  port: 3306,
  database: 'rds_dingding',
  user: 'ram_dingding',
  password: 'h5J5BVEXtrjKVDSxmS4w',
  charset: 'utf8mb4',
};

async function main() {
  const conn = await mysql.createConnection(mysqlConfig);

  // 添加 contact 字段（兼容旧表）
  try {
    await conn.execute(`ALTER TABLE delivery_orders ADD COLUMN contact VARCHAR(100) DEFAULT ''`);
    console.log('已添加 contact 字段');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log('contact 字段已存在，跳过');
    } else {
      throw e;
    }
  }

  // 添加缺失字段（兼容旧表）
  const missingFields = [
    ['project', 'VARCHAR(200) DEFAULT \'\''],
    ['remark', 'TEXT DEFAULT \'\''],
  ];
  for (const [col, def] of missingFields) {
    try {
      await conn.execute(`ALTER TABLE delivery_orders ADD COLUMN ${col} ${def}`);
      console.log(`已添加 ${col} 字段`);
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log(`${col} 字段已存在，跳过`);
      } else {
        console.log(`添加 ${col} 失败: ${e.message}`);
      }
    }
  }

  // 查询最近的送货单
  const [orders] = await conn.execute(`
    SELECT id, order_no, customer_name, contact, customer_phone,
           customer_address, delivery_date, project, total_amount, status, remark
    FROM delivery_orders
    ORDER BY create_time DESC
    LIMIT 10
  `);

  console.log('\n=== 送货单列表 ===');
  for (const o of orders) {
    console.log(`ID: ${o.id}, 单号: ${o.order_no}, 客户: ${o.customer_name}, 联系人: ${o.contact || '(空)'}, 项目: ${o.project || '(空)'}`);
  }

  // 查询明细
  console.log('\n=== 商品明细 ===');
  for (const o of orders) {
    const [items] = await conn.execute(`
      SELECT id, product_name, model, length, wattage, brightness, sensor_mode,
             quantity, unit, unit_price, amount
      FROM delivery_items
      WHERE delivery_id = ?
    `, [o.id]);

    if (items.length === 0) {
      console.log(`\n[${o.order_no}] 无明细`);
    } else {
      for (const item of items) {
        console.log(`\n[${o.order_no}] ID=${item.id} 商品: ${item.product_name}`);
        console.log(`  型号="${item.model || ''}" 长度="${item.length || ''}" 瓦数="${item.wattage || ''}" 亮度="${item.brightness || ''}" 感应="${item.sensor_mode || ''}"`);
        console.log(`  数量=${item.quantity} 单位=${item.unit} 单价=${item.unit_price} 小计=${item.amount}`);
      }
    }
  }

  await conn.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
