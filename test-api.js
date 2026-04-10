const http = require('http');

const data = JSON.stringify({
  orderId: 'TEST_123',
  amount: 19900,
  description: '测试支付',
  paymentMethod: 'wechat'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/create_payment',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log('状态码:', res.statusCode);
    console.log('响应:', body);
  });
});

req.on('error', (e) => {
  console.error('请求错误:', e);
});

req.write(data);
req.end();
