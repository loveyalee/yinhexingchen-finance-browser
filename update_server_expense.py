import os

server_path = '/var/www/yinhexingchen/server.js'

with open(server_path, 'r', encoding='utf-8') as f:
    content = f.read()

marker = "  // ==================== 出入库记录API ===================="
api_code = """  // ==================== 费用报销API ====================
  // 获取费用报销列表：GET /api/expenses
  } else if (pathname === '/api/expenses' && req.method === 'GET') {
    const userId = parsedUrl.query.userId;
    try {
      if (mysqlPool) {
        const [rows] = await mysqlPool.execute(
          'SELECT * FROM expense_reimbursements WHERE user_id = ? ORDER BY create_time DESC',
          [userId || '']
        );
        for (const expense of rows) {
          const [items] = await mysqlPool.execute(
            'SELECT * FROM expense_items WHERE expense_id = ?',
            [expense.id]
          );
          expense.items = items;
          if (expense.create_time) expense.create_time = expense.create_time.toISOString();
          if (expense.update_time) expense.update_time = expense.update_time.toISOString();
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, data: rows }));
      } else {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '数据库服务未启动' }));
      }
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '获取费用报销失败: ' + e.message }));
    }

  // 创建费用报销单：POST /api/expenses
  } else if (pathname === '/api/expenses' && req.method === 'POST') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', async function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.title || !data.user_id) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '标题和用户ID为必填项' }));
          return;
        }
        if (!mysqlPool) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库服务未启动' }));
          return;
        }
        const id = data.id || 'ER' + Date.now();
        const items = data.items || [];
        let totalAmount = 0;
        for (const item of items) {
          totalAmount += parseFloat(item.amount) || 0;
        }
        await mysqlPool.execute(
          'INSERT INTO expense_reimbursements (id, expense_no, title, amount, category, description, receipt_count, status, user_id, user_name, create_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE title=VALUES(title), amount=VALUES(amount), category=VALUES(category), description=VALUES(description), receipt_count=VALUES(receipt_count), status=VALUES(status), update_time=NOW()',
          [id, data.expense_no || 'EXP' + Date.now(), data.title, totalAmount, data.category || 'general', data.description || '', items.length, data.status || 'pending', data.user_id, data.user_name || '']
        );
        await mysqlPool.execute('DELETE FROM expense_items WHERE expense_id = ?', [id]);
        for (const item of items) {
          await mysqlPool.execute(
            'INSERT INTO expense_items (expense_id, date, type, amount, description) VALUES (?, ?, ?, ?, ?)',
            [id, item.date || null, item.type || '', item.amount || 0, item.description || '']
          );
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '费用报销单保存成功', id: id }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '保存失败: ' + e.message }));
      }
    });

  // 更新费用报销状态：PUT /api/expenses/:id/status
  } else if (pathname.startsWith('/api/expenses/') && pathname.endsWith('/status') && req.method === 'PUT') {
    const id = pathname.split('/')[3];
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', async function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!mysqlPool) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库服务未启动' }));
          return;
        }
        let updateField = 'status = ?';
        let updateValue = data.status;
        if (data.status === 'approved') {
          updateField += ', approver = ?, approved_time = NOW()';
          updateValue = [data.status, data.approver || ''];
        } else if (data.status === 'paid') {
          updateField += ', paid_time = NOW()';
        }
        const sql = 'UPDATE expense_reimbursements SET ' + updateField + ', update_time = NOW() WHERE id = ?';
        await mysqlPool.execute(sql, Array.isArray(updateValue) ? [...updateValue, id] : [updateValue, id]);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '状态更新成功' }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '更新失败: ' + e.message }));
      }
    });

  // 删除费用报销单：DELETE /api/expenses/:id
  } else if (pathname.startsWith('/api/expenses/') && !pathname.includes('/status') && req.method === 'DELETE') {
    const id = pathname.split('/')[3];
    try {
      if (!mysqlPool) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '数据库服务未启动' }));
        return;
      }
      await mysqlPool.execute('DELETE FROM expense_reimbursements WHERE id = ?', [id]);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, message: '删除成功' }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '删除失败: ' + e.message }));
    }

"""

if marker in content and '/api/expenses' not in content:
    content = content.replace(marker, api_code + marker)
    with open(server_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('Added expense API to server.js')
else:
    print('Already has expense API or marker not found')
