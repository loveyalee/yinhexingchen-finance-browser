const fs = require('fs');
const filePath = '/var/www/yinhexingchen/server.js';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/Version: '2019-11-07'/g, "Version: '2021-07-07'");

fs.writeFileSync(filePath, content);
console.log('Version 已修复');
