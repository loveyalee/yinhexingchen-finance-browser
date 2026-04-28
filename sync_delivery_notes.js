const mysql = require('mysql2/promise');

async function syncDeliveryNotes() {
  let conn;
  try {
    conn = await mysql.createConnection({
      host: 'rm-bp1t731ujc98jo9c10o.mysql.rds.aliyuncs.com',
      port: 3306,
      user: 'ram_dingding',
      password: 'h5J5BVEXtrjKVDSxmS4w',
      database: 'rds_dingding'
    });
    
    // 从delivery_orders获取有项目或联系人信息的数据
    const [orders] = await conn.query(`
      SELECT id, order_no, customer_name, project_name, project, contact, contact_name, customer_phone, customer_address, remark, delivery_date, total_amount, status, user_id
      FROM delivery_orders 
      WHERE (project_name IS NOT NULL AND project_name != '')
         OR (project IS NOT NULL AND project != '')
         OR (contact IS NOT NULL AND contact != '')
         OR (contact_name IS NOT NULL AND contact_name != '')
    `);
    
    console.log(`找到 ${orders.length} 条有项目或联系人信息的订单`);
    
    let updated = 0;
    let inserted = 0;
    
    for (const order of orders) {
      // 检查是否已存在于delivery_notes
      const [existing] = await conn.query('SELECT id FROM delivery_notes WHERE no = ?', [order.order_no]);
      
      if (existing.length > 0) {
        // 更新现有记录
        await conn.query(`
          UPDATE delivery_notes 
          SET customer = ?, project_name = ?, contact = ?, contact_phone = ?, address = ?, remark = ?, date = ?, status = ?, user_id = ?
          WHERE no = ?
        `, [
          order.customer_name,
          order.project_name || order.project || '',
          order.contact || order.contact_name || '',
          order.customer_phone || '',
          order.customer_address || '',
          order.remark || '',
          order.delivery_date,
          order.status || 'draft',
          order.user_id,
          order.order_no
        ]);
        updated++;
        console.log(`更新: ${order.order_no} - ${order.customer_name}`);
        console.log(`  项目: ${order.project_name || order.project}, 联系人: ${order.contact || order.contact_name}`);
      } else {
        // 插入新记录
        await conn.query(`
          INSERT INTO delivery_notes (no, customer, project_name, contact, contact_phone, address, remark, date, status, user_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          order.order_no,
          order.customer_name,
          order.project_name || order.project || '',
          order.contact || order.contact_name || '',
          order.customer_phone || '',
          order.customer_address || '',
          order.remark || '',
          order.delivery_date,
          order.status || 'draft',
          order.user_id
        ]);
        inserted++;
        console.log(`新增: ${order.order_no} - ${order.customer_name}`);
        console.log(`  项目: ${order.project_name || order.project}, 联系人: ${order.contact || order.contact_name}`);
      }
    }
    
    console.log(`\n完成! 更新: ${updated} 条, 新增: ${inserted} 条`);
    
    await conn.end();
  } catch (e) {
    console.log('Error:', e.message);
    if (conn) await conn.end();
  }
}

syncDeliveryNotes();
