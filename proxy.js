// 反向代理服务器 - 将公网流量转发到本地 server.js
const http = require('http');
const httpProxy = require('http-proxy');

// 创建代理
const proxy = httpProxy.createProxyServer({
  target: 'http://localhost:8080',
  changeOrigin: true,
  ws: true // 支持 WebSocket
});

// 错误处理
proxy.on('error', (err, req, res) => {
  console.error('代理错误:', err);
  res.writeHead(502, { 'Content-Type': 'text/plain' });
  res.end('Bad Gateway - 无法连接到后端服务器');
});

// 创建 HTTP 服务器
const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  proxy.web(req, res);
});

// 支持 WebSocket
server.on('upgrade', (req, socket, head) => {
  proxy.ws(req, socket, head);
});

const PORT = process.env.PROXY_PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n========================================`);
  console.log(`反向代理服务器已启动`);
  console.log(`监听地址: 0.0.0.0:${PORT}`);
  console.log(`转发目标: http://localhost:8080`);
  console.log(`========================================\n`);
});
