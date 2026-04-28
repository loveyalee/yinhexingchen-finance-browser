// 通过API将送货单数据推送到线上服务器
const https = require('https');
const Database = require('better-sqlite3');

// 本地SQLite配置
const localDbPath = 'E:\\yinhexingchen\\db\\users.db';
const db = new Database(localDbPath);

// 线上服务器配置
const domain = 'zonya.work';

console.log('=== 推送送货单数据到线上服务器 ===\n');

// 从本地数据库获取送货单
const deliveryNotes = db.prepare('SELECT * FROM delivery_notes').all();
console.log('本地送货单数量:', deliveryNotes.length);

if (deliveryNotes.length === 0) {
  console.log('没有送货单需要推送');
  db.close();
  return;
}

// 推送每个送货单
deliveryNotes.forEach((note, index) => {
  console.log(`\n正在推送送货单 ${index + 1}: ${note.no}`);
  
  const postData = JSON.stringify({
    no: note.no,
    customer: note.customer,
    contact: note.contact,
    contactPhone: note.contact_phone,
    date: note.date,
    status: note.status,
    address: note.address,
    remark: note.remark,
    items: note.items,
    userId: note.user_id
  });

  const options = {
    hostname: domain,
    path: '/api/delivery-notes',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const jsonData = JSON.parse(data);
        if (jsonData.success) {
          console.log(`✅ 送货单 ${note.no} 推送成功`);
        } else {
          console.log(`❌ 送货单 ${note.no} 推送失败:`, jsonData.message);
        }
      } catch (error) {
        console.log(`❌ 送货单 ${note.no} 推送失败:`, error.message);
      }
    });
  });

  req.on('error', (error) => {
    console.log(`❌ 送货单 ${note.no} 推送失败:`, error.message);
  });

  req.write(postData);
  req.end();
});

db.close();
console.log('\n数据库连接已关闭');