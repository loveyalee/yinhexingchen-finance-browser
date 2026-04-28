// 修复阿里云数据库中送货单明细的型号/长度/瓦数字段
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

  // 修复 SHD20260416196 (delivery_id=4) 的明细
  // ID=49: T8, 1.2m, 2-8W, 双亮, 雷达感应
  await conn.execute(`
    UPDATE delivery_items SET model = 'T8', length = '1.2m', wattage = '2-8W'
    WHERE id = 49
  `);
  console.log('已更新 ID=49: T8, 1.2m, 2-8W');

  // ID=50: T8, 1.2m, 5W, 单亮, 无感应
  await conn.execute(`
    UPDATE delivery_items SET model = 'T8', length = '1.2m', wattage = '5W', sensor_mode = ''
    WHERE id = 50
  `);
  console.log('已更新 ID=50: T8, 1.2m, 5W, 单亮(无感应)');

  // 同时把 remark 字段也补上（TEXT 类型不能有默认值，用 MODIFY）
  try {
    await conn.execute(`ALTER TABLE delivery_orders MODIFY COLUMN remark TEXT`);
    console.log('remark 字段已修改为 TEXT');
  } catch (e) {
    if (e.code !== 'ER_BAD_FIELD_ERROR') console.log('remark 修改:', e.message);
  }

  // 同时把 contact 字段补上（之前的 ALTER 成功了，先查一下 contact 值是否需要回填）
  // 从送货单数据看，联系人应该可以从客户名关联，但暂时先留空

  // 验证更新结果
  const [items] = await conn.execute(`
    SELECT id, product_name, model, length, wattage, brightness, sensor_mode, quantity
    FROM delivery_items WHERE delivery_id = 4
  `);
  console.log('\n验证 SHD20260416196 明细:');
  for (const item of items) {
    console.log(`  ID=${item.id} 商品=${item.product_name} 型号=${item.model} 长度=${item.length} 瓦数=${item.wattage} 亮度=${item.brightness} 感应=${item.sensor_mode} 数量=${item.quantity}`);
  }

  await conn.end();
  console.log('\n完成!');
}

main().catch(e => { console.error(e.message); process.exit(1); });
