// 检查users表结构并创建kaola用户
const Database = require('better-sqlite3');

// 本地SQLite配置
const localDbPath = 'E:\\yinhexingchen\\db\\users.db';
const db = new Database(localDbPath);

console.log('=== 检查users表结构 ===\n');

try {
  // 获取表结构
  const tableInfo = db.prepare('PRAGMA table_info(users)').all();
  console.log('users表字段:');
  tableInfo.forEach(col => {
    console.log(`- ${col.name} (${col.type})`);
  });

  // 创建kaola用户（使用现有字段）
  console.log('\n=== 创建kaola用户 ===');
  
  const existingUser = db.prepare('SELECT * FROM users WHERE id = ?').get('USER_1776900041357');
  
  if (existingUser) {
    console.log('kaola用户已存在');
    console.log('- ID:', existingUser.id);
    console.log('- 用户名:', existingUser.username);
    console.log('- 手机号:', existingUser.phone);
  } else {
    console.log('创建kaola用户...');
    
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO users (
        id, username, phone, password, user_type, 
        create_time, update_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      'USER_1776900041357',  // id
      'kaola',               // username
      '13873121186',         // phone
      'encrypted_password',  // password
      'enterprise',          // user_type
      now,                   // create_time
      now                    // update_time
    );
    
    console.log('✅ kaola用户创建成功！');
  }

  // 验证
  console.log('\n=== 验证结果 ===');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get('USER_1776900041357');
  const notes = db.prepare('SELECT * FROM delivery_notes WHERE user_id = ?').all('USER_1776900041357');
  
  console.log('用户信息:');
  console.log('- ID:', user.id);
  console.log('- 用户名:', user.username);
  console.log('- 手机号:', user.phone);
  console.log('- 用户类型:', user.user_type);
  
  console.log('\n送货单数量:', notes.length);
  notes.forEach((note, index) => {
    console.log(`\n送货单 ${index + 1}:`);
    console.log('- 单号:', note.no);
    console.log('- 客户:', note.customer);
    console.log('- 联系人:', note.contact);
    console.log('- 电话:', note.contact_phone);
    console.log('- 状态:', note.status);
  });

  console.log('\n✅ 完成！kaola用户现在应该能看到送货单了。');

} catch (error) {
  console.error('操作失败:', error.message);
} finally {
  db.close();
  console.log('\n数据库连接已关闭');
}