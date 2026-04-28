// 检查服务器端API实现
const fs = require('fs');
const path = require('path');

const serverPath = 'E:\\yinhexingchen\\server.js';

if (fs.existsSync(serverPath)) {
    const content = fs.readFileSync(serverPath, 'utf8');
    
    // 查找送货单相关的API实现
    const deliveryNotesApi = content.match(/\/api\/delivery-notes[\s\S]*?(?=else if|\}\n\s*else|$)/);
    
    if (deliveryNotesApi) {
        console.log('=== 服务器端送货单API实现 ===');
        console.log(deliveryNotesApi[0]);
    } else {
        console.log('未找到送货单API实现');
    }
} else {
    console.log('服务器文件不存在');
}

// 同时检查线上服务器的API实现
const onlineServerPath = '/var/www/yinhexingchen/server.js';
console.log('\n=== 检查线上服务器API实现 ===');
console.log('需要在服务器上执行:');
console.log('grep -n -A 50 "\/api\/delivery-notes" ' + onlineServerPath);