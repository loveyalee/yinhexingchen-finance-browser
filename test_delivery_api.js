// 测试API是否能正确返回送货单
const http = require('http');

const userId = 'USER_1776900041357';

const options = {
  hostname: 'localhost',
  port: 5098,
  path: '/api/delivery-notes?userId=' + encodeURIComponent(userId),
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('=== 测试送货单API ===\n');
console.log('请求URL:', 'http://localhost:5098/api/delivery-notes?userId=' + userId);
console.log('');

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('响应状态码:', res.statusCode);
    console.log('响应数据:');
    
    try {
      const jsonData = JSON.parse(data);
      console.log(JSON.stringify(jsonData, null, 2));
      
      if (jsonData.success && jsonData.data) {
        console.log('\n✅ API返回成功！');
        console.log('送货单数量:', jsonData.data.length);
        
        if (jsonData.data.length > 0) {
          console.log('\n送货单详情:');
          jsonData.data.forEach((note, index) => {
            console.log(`\n${index + 1}. 单号: ${note.no}`);
            console.log(`   客户: ${note.customer}`);
            console.log(`   联系人: ${note.contact}`);
            console.log(`   电话: ${note.contact_phone}`);
            console.log(`   状态: ${note.status}`);
            console.log(`   用户ID: ${note.user_id}`);
          });
        } else {
          console.log('\n⚠️ 没有找到送货单！');
        }
      } else {
        console.log('\n❌ API返回失败:', jsonData.message);
      }
    } catch (error) {
      console.error('解析响应失败:', error.message);
      console.log('原始数据:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ 请求失败:', error.message);
  console.log('\n可能的原因:');
  console.log('1. 服务器未启动（端口5098）');
  console.log('2. 服务器启动在其他端口');
  console.log('\n请检查服务器是否正在运行:');
  console.log('  node server.js');
});

req.end();