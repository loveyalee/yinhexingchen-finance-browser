// 检查服务器端MySQL连接问题
const fs = require('fs');
const path = require('path');

const serverPath = 'E:\\yinhexingchen\\server.js';

if (fs.existsSync(serverPath)) {
    const content = fs.readFileSync(serverPath, 'utf8');
    
    // 查找MySQL连接配置
    const mysqlConfig = content.match(/const mysqlConfig[\s\S]*?\}/);
    if (mysqlConfig) {
        console.log('=== MySQL连接配置 ===');
        console.log(mysqlConfig[0]);
    }
    
    // 查找MySQL连接池初始化
    const mysqlPoolInit = content.match(/mysqlPool[\s\S]*?;/);
    if (mysqlPoolInit) {
        console.log('\n=== MySQL连接池初始化 ===');
        console.log(mysqlPoolInit[0]);
    }
    
    // 查找错误处理
    const mysqlError = content.match(/MySQL获取送货单失败[\s\S]*?console\.error/);
    if (mysqlError) {
        console.log('\n=== MySQL错误处理 ===');
        console.log(mysqlError[0]);
    }
} else {
    console.log('服务器文件不存在');
}

// 测试直接连接MySQL
const mysql = require('mysql2/promise');

const testConfig = {
  host: 'rm-bp1t731ujc98jo9c10o.mysql.rds.aliyuncs.com',
  port: 3306,
  database: 'rds_dingding',
  user: 'ram_dingding',
  password: 'h5J5BVEXtrjKVDSxmS4w',
  charset: 'utf8mb4',
  timezone: '+08:00'
};

async function testMySQLConnection() {
  console.log('\n=== 测试MySQL连接 ===');
  let conn;
  try {
    conn = await mysql.createConnection(testConfig);
    console.log('✅ MySQL连接成功');
    
    // 测试查询
    const [rows] = await conn.execute('SELECT * FROM delivery_orders WHERE user_id = ?', ['USER_1776900041357']);
    console.log(`✅ 查询成功，返回 ${rows.length} 条记录`);
    
    rows.forEach((row, index) => {
      console.log(`\n记录 ${index + 1}:`);
      console.log(`- 单号: ${row.order_no}`);
      console.log(`- 客户: ${row.customer_name}`);
      console.log(`- 电话: ${row.customer_phone}`);
      console.log(`- 地址: ${row.customer_address}`);
      console.log(`- 日期: ${row.delivery_date}`);
      console.log(`- 金额: ${row.total_amount}`);
      console.log(`- 状态: ${row.status}`);
    });
    
  } catch (error) {
    console.error('❌ MySQL连接失败:', error.message);
  } finally {
    if (conn) {
      await conn.end();
      console.log('\nMySQL连接已关闭');
    }
  }
}

testMySQLConnection();