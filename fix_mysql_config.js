// 修复服务器端的MySQL连接配置
const fs = require('fs');
const path = require('path');

const serverPath = 'E:\\yinhexingchen\\server.js';
let content = fs.readFileSync(serverPath, 'utf8');

// 替换MySQL配置，使用硬编码的配置而不是环境变量
const mysqlConfigFix = `  const mysqlConfig = {
    host: 'rm-bp1t731ujc98jo9c10o.mysql.rds.aliyuncs.com',
    port: 3306,
    database: 'rds_dingding',
    user: 'ram_dingding',
    password: 'h5J5BVEXtrjKVDSxmS4w',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4',
    timezone: '+08:00'
  };`;

// 替换原始配置
content = content.replace(/const mysqlConfig = \{[\s\S]*?\};/, mysqlConfigFix);

// 保存修改
fs.writeFileSync(serverPath, content, 'utf8');

console.log('✅ 服务器端MySQL配置修复完成！');
console.log('1. 替换了环境变量配置为硬编码的阿里云RDS配置');
console.log('2. 确保MySQL连接池能够正常初始化');
console.log('3. 现在API会从阿里云主数据库获取数据');
console.log('\n现在需要将修改后的文件上传到服务器...');