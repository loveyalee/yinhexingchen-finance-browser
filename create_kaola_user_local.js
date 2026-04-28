// 在本地SQLite中创建kaola用户
const Database = require('better-sqlite3');

// 本地SQLite配置
const localDbPath = 'E:\\yinhexingchen\\db\\users.db';
const db = new Database(localDbPath);

console.log('=== 在本地SQLite中创建kaola用户 ===\n');

try {
  // 检查kaola用户是否已存在
  const existingUser = db.prepare('SELECT * FROM users WHERE id = ?').get('USER_1776900041357');
  
  if (existingUser) {
    console.log('kaola用户已存在:');
    console.log('- ID:', existingUser.id);
    console.log('- 用户名:', existingUser.username);
    console.log('- 手机号:', existingUser.phone);
  } else {
    console.log('kaola用户不存在，正在创建...');
    
    // 创建kaola用户
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO users (
        id, username, phone, password, user_type, 
        enterprise_name, contact_person, industry,
        create_time, update_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      'USER_1776900041357',  // id
      'kaola',               // username
      '13873121186',         // phone
      'encrypted_password',  // password (实际密码在阿里云RDS中)
      'enterprise',          // user_type
      'Kola企业',            // enterprise_name
      'Kola管理员',          // contact_person
      '科技',                // industry
      now,                   // create_time
      now                    // update_time
    );
    
    console.log('✅ kaola用户创建成功！');
  }

  // 验证用户和送货单匹配
  console.log('\n=== 验证用户和送货单匹配 ===');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get('USER_1776900041357');
  const notes = db.prepare('SELECT * FROM delivery_notes WHERE user_id = ?').all('USER_1776900041357');
  
  console.log('用户信息:');
  console.log('- ID:', user.id);
  console.log('- 用户名:', user.username);
  console.log('- 手机号:', user.phone);
  console.log('- 企业名称:', user.enterprise_name);
  
  console.log('\n该用户的送货单数量:', notes.length);
  notes.forEach((note, index) => {
    console.log(`\n送货单 ${index + 1}:`);
    console.log('- 单号:', note.no);
    console.log('- 客户:', note.customer);
    console.log('- 联系人:', note.contact);
    console.log('- 电话:', note.contact_phone);
    console.log('- 地址:', note.address);
    console.log('- 日期:', note.date);
    console.log('- 状态:', note.status);
  });

  console.log('\n✅ 操作完成！现在kaola用户登录后应该能看到送货单了。');

} catch (error) {
  console.error('操作失败:', error.message);
  console.error('错误堆栈:', error.stack);
} finally {
  db.close();
  console.log('\n数据库连接已关闭');
}