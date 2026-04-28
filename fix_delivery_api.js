// 修复服务器端的送货单API，让它优先从MySQL获取数据
const fs = require('fs');
const path = require('path');

const serverPath = 'E:\\yinhexingchen\\server.js';
let content = fs.readFileSync(serverPath, 'utf8');

// 1. 查找送货单API的位置
const deliveryNotesAPIStart = content.indexOf('  // 获取送货单列表：GET /api/delivery-notes');
const deliveryNotesAPIEnd = content.indexOf('  // 添加送货单：POST /api/delivery-notes', deliveryNotesAPIStart);

if (deliveryNotesAPIStart !== -1 && deliveryNotesAPIEnd !== -1) {
    // 提取原始API代码
    const originalAPI = content.substring(deliveryNotesAPIStart, deliveryNotesAPIEnd);
    console.log('找到送货单API，开始修复...');
    
    // 替换为新的API代码，优先从MySQL获取数据
    const newAPI = `  // 获取送货单列表：GET /api/delivery-notes
  } else if (pathname === '/api/delivery-notes' && req.method === 'GET') {
    const userId = parsedUrl.query.userId;

    // 优先从MySQL获取
    if (mysqlPool) {
      try {
        const [orders] = await mysqlPool.execute(
          'SELECT * FROM delivery_orders WHERE user_id = ? ORDER BY create_time DESC',
          [userId || '']
        );

        const data = [];
        for (const order of orders) {
          // 获取该送货单的商品明细
          const [items] = await mysqlPool.execute(
            'SELECT product_name, quantity, unit_price, amount FROM delivery_items WHERE delivery_id = ?',
            [order.id]
          );

          data.push({
            id: order.id,
            no: order.order_no,
            customer: order.customer_name,
            contact: order.contact_name || '',
            contact_phone: order.customer_phone || '',
            date: order.delivery_date.toISOString().split('T')[0],
            status: order.status === 'pending' ? '待送达' : '已送达',
            address: order.customer_address || '',
            remark: order.remark || '',
            items: items.map(item => ({
              product: item.product_name,
              quantity: item.quantity,
              price: item.unit_price
            })),
            user_id: order.user_id,
            create_time: order.create_time,
            update_time: order.update_time
          });
        }

        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, data: data }));
        return;
      } catch (e) {
        console.error('MySQL获取送货单失败:', e.message);
      }
    }

    // 回退到SQLite
    if (!usersDb) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: [] }));
      return;
    }
    try {
      const notes = usersDb.prepare('SELECT * FROM delivery_notes WHERE user_id = ? ORDER BY create_time DESC').all(userId || '');
      const data = notes.map(note => ({
        ...note,
        items: note.items ? JSON.parse(note.items) : []
      }));
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: data }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '获取送货单列表失败: ' + e.message }));
    }
  // 添加送货单：POST /api/delivery-notes`;
    
    // 替换API代码
    content = content.replace(originalAPI, newAPI.substring(0, newAPI.length - 36)); // 移除最后的注释
    
    // 保存修改
    fs.writeFileSync(serverPath, content, 'utf8');
    
    console.log('✅ 服务器端送货单API修复完成！');
    console.log('1. 修改了送货单API，优先从MySQL获取数据');
    console.log('2. 只有在MySQL获取失败时才回退到SQLite');
    console.log('3. 确保API返回阿里云主数据库中的所有送货单');
    console.log('\n现在需要将修改后的文件上传到服务器...');
} else {
    console.log('❌ 未找到送货单API代码');
}