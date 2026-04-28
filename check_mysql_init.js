// 检查服务器端的MySQL初始化代码
const fs = require('fs');
const path = require('path');

const serverPath = 'E:\\yinhexingchen\\server.js';

if (fs.existsSync(serverPath)) {
    const content = fs.readFileSync(serverPath, 'utf8');
    
    // 查找MySQL初始化代码
    const mysqlInit = content.match(/function initMySQL\(\)[\s\S]*?\}/);
    if (mysqlInit) {
        console.log('=== MySQL初始化代码 ===');
        console.log(mysqlInit[0]);
    }
    
    // 查找送货单API代码
    const deliveryAPI = content.match(/\/api\/delivery-notes[\s\S]*?(?=else if|\}\n\s*else|$)/);
    if (deliveryAPI) {
        console.log('\n=== 送货单API代码 ===');
        console.log(deliveryAPI[0]);
    }
} else {
    console.log('服务器文件不存在');
}

// 测试直接连接MySQL并查询
const mysql = require('mysql2/promise');

const config = {
  host: 'rm-bp1t731ujc98jo9c10o.mysql.rds.aliyuncs.com',
  port: 3306,
  database: 'rds_dingding',
  user: 'ram_dingding',
  password: 'h5J5BVEXtrjKVDSxmS4w',
  charset: 'utf8mb4',
  timezone: '+08:00'
};

async function testMySQLQuery() {
  console.log('\n=== 测试MySQL查询 ===');
  let conn;
  try {
    conn = await mysql.createConnection(config);
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
    console.error('❌ MySQL查询失败:', error.message);
  } finally {
    if (conn) {
      await conn.end();
      console.log('\nMySQL连接已关闭');
    }
  }
}

testMySQLQuery();