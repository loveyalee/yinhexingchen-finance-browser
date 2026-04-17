// 站内消息测试服务器
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

// 数据库初始化
let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
  console.error('better-sqlite3 未安装，消息功能不可用:', e.message);
}

// 数据库目录
const dbDir = path.join(__dirname, 'db');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

// 数据库连接
let usersDb = null;
function initDb() {
  if (Database) {
    try {
      usersDb = new Database(path.join(dbDir, 'users.db'));
      // 创建管理员通知表
      usersDb.exec(`
        CREATE TABLE IF NOT EXISTS admin_notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          create_time TEXT NOT NULL,
          status TEXT DEFAULT 'unread'
        );
      `);
      console.log('消息数据库初始化完成');
    } catch (e) {
      console.error('数据库初始化失败:', e.message);
    }
  }
}

// 初始化数据库
initDb();

// 创建服务器
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  // 静态文件服务
  if (req.method === 'GET' && !pathname.startsWith('/api')) {
    let filePath = path.join(__dirname, pathname === '/' ? 'admin.html' : decodeURIComponent(pathname));
    
    // 安全检查
    if (!filePath.startsWith(__dirname)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }
    
    const extname = path.extname(filePath);
    const contentType = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.md': 'text/markdown',
      '.txt': 'text/plain'
    }[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
      if (error) {
        if (error.code === 'ENOENT') {
          res.statusCode = 404;
          res.end('File not found');
        } else {
          res.statusCode = 500;
          res.end('Server Error');
        }
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content, 'utf-8');
      }
    });
    return;
  }

  // 消息API
  if (pathname === '/api/admin/messages' && req.method === 'GET') {
    if (!usersDb) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: [] }));
      return;
    }
    try {
      const messages = usersDb.prepare('SELECT * FROM admin_notifications ORDER BY create_time DESC').all();
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: true, data: messages }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ success: false, message: '获取消息失败: ' + e.message }));
    }
  } else if (pathname === '/api/admin/messages/read' && req.method === 'POST') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.id) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '消息ID为必填项' }));
          return;
        }
        if (!usersDb) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库服务未启动' }));
          return;
        }
        usersDb.prepare('UPDATE admin_notifications SET status = ? WHERE id = ?').run('read', data.id);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '消息已标记为已读' }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '标记消息失败: ' + e.message }));
      }
    });
  } else if (pathname === '/api/admin/messages/delete' && req.method === 'POST') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.id) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '消息ID为必填项' }));
          return;
        }
        if (!usersDb) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '数据库服务未启动' }));
          return;
        }
        usersDb.prepare('DELETE FROM admin_notifications WHERE id = ?').run(data.id);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: true, message: '消息已删除' }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '删除消息失败: ' + e.message }));
      }
    });
  } else if (pathname === '/api/users/register' && req.method === 'POST') {
    let body = '';
    req.on('data', function(chunk) { body += chunk.toString('utf8'); });
    req.on('end', function() {
      try {
        const data = JSON.parse(body || '{}');
        if (!data.phone || !data.password || !data.userType) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ success: false, message: '手机号、密码、用户类型为必填项' }));
          return;
        }

        const userId = 'USER_' + Date.now();
        const now = new Date().toISOString();
        const user = {
          id: userId,
          username: data.username || data.phone,
          phone: data.phone,
          password: data.password,
          user_type: data.userType,
          create_time: now,
          update_time: now
        };

        // 发送管理员提醒
        const adminMessage = `📢 新用户注册通知\n\n用户ID: ${user.id}\n手机号: ${user.phone}\n用户类型: ${user.user_type === 'enterprise' ? '企业用户' : user.user_type === 'institution' ? '机构用户' : '个人用户'}\n${user.user_type === 'enterprise' ? `企业名称: ${data.institutionName || '未填写'}` : `用户名: ${user.username}`}\n注册时间: ${new Date().toLocaleString('zh-CN')}`;
        
        // 存储到管理员通知系统
        if (usersDb) {
          usersDb.prepare('INSERT INTO admin_notifications (type, title, content, create_time, status) VALUES (?, ?, ?, ?, ?)')
            .run('user_register', '新用户注册', adminMessage, new Date().toISOString(), 'unread');
        }
        
        console.log('管理员提醒已发送:', adminMessage);
        
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          success: true,
          data: {
            id: user.id,
            phone: user.phone,
            userType: user.user_type
          },
          message: '注册成功，已发送通知'  
        }));
      } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ success: false, message: '注册失败: ' + e.message }));
      }
    });
  } else {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ success: false, message: 'Not found' }));
  }
});

// 启动服务器
const PORT = process.env.PORT || 3004;
server.listen(PORT, () => {
  console.log(`\n========================================`);
  console.log(`站内消息测试服务器已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`========================================`);
  console.log(`API端点:`);
  console.log(`  GET  /api/admin/messages         - 获取站内消息`);
  console.log(`  POST /api/admin/messages/read    - 标记消息已读`);
  console.log(`  POST /api/admin/messages/delete  - 删除消息`);
  console.log(`  POST /api/users/register        - 注册新用户（测试通知）`);
  console.log(`========================================\n`);
});
