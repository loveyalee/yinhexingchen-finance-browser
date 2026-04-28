/**
 * 添加客户信息到kaola用户
 */

const https = require('https');

// kaola用户ID
const KAOLA_USER_ID = 'USER_1776900041357';

// 要添加的客户信息
const customers = [
  {
    name: '长沙市长腾物业管理有限公司',
    contact: '',
    phone: '18174433796',
    address: '长沙市芙蓉区浏正街41号'
  },
  {
    name: '长沙市长腾物业管理有限公司望城分公司',
    contact: '',
    phone: '18975152694',
    address: '长沙市望城经济技术开发区同心路与马桥河路交汇处东北角金星珑湾'
  }
];

// 通过API添加客户
function addCustomer(customer) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      name: customer.name,
      contact: customer.contact,
      phone: customer.phone,
      address: customer.address,
      userId: KAOLA_USER_ID
    });

    const options = {
      hostname: 'zonya.work',
      port: 443,
      path: '/api/customers',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('=== 添加客户信息到kaola用户 ===');
  console.log('用户ID:', KAOLA_USER_ID);
  console.log('');

  for (const customer of customers) {
    console.log('添加客户:', customer.name);
    try {
      const result = await addCustomer(customer);
      if (result.success) {
        console.log('  成功! ID:', result.data?.id);
      } else {
        console.log('  失败:', result.message);
      }
    } catch (e) {
      console.log('  错误:', e.message);
    }
  }

  console.log('');
  console.log('=== 完成 ===');
}

main();
