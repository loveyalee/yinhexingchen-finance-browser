// 测试线上域名API
const https = require('https');

const userId = 'USER_1776900041357';
const domain = 'zonya.work';

const options = {
  hostname: domain,
  path: '/api/delivery-notes?userId=' + encodeURIComponent(userId),
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
};

console.log('=== 测试线上域名API ===\n');
console.log('请求URL:', `https://${domain}/api/delivery-notes?userId=${userId}`);
console.log('');

const req = https.request(options, (res) => {
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
        console.log('\n✅ 线上API返回成功！');
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
          console.log('\n⚠️ 线上没有找到送货单！');
          console.log('需要将本地数据同步到线上服务器');
        }
      } else {
        console.log('\n❌ 线上API返回失败:', jsonData.message);
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
  console.log('1. 域名解析失败');
  console.log('2. 服务器未启动');
  console.log('3. SSL证书问题');
});

req.end();