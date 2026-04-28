// 检查kaola用户的localStorage数据和送货单匹配情况
const Database = require('better-sqlite3');

// 本地SQLite配置
const localDbPath = 'E:\\yinhexingchen\\db\\users.db';
const db = new Database(localDbPath);

console.log('=== 检查kaola用户和送货单匹配情况 ===\n');

// 1. 检查本地SQLite中的所有用户
console.log('【1】本地SQLite中的所有用户:');
const allUsers = db.prepare('SELECT * FROM users').all();
allUsers.forEach((user, index) => {
  console.log(`${index + 1}. ID: ${user.id}`);
  console.log(`   用户名: ${user.username}`);
  console.log(`   手机号: ${user.phone}`);
  console.log(`   用户类型: ${user.user_type}`);
  console.log('');
});

// 2. 检查本地SQLite中的所有送货单
console.log('【2】本地SQLite中的所有送货单:');
const allNotes = db.prepare('SELECT * FROM delivery_notes').all();
allNotes.forEach((note, index) => {
  console.log(`${index + 1}. 单号: ${note.no}`);
  console.log(`   用户ID: ${note.user_id}`);
  console.log(`   客户: ${note.customer}`);
  console.log('');
});

// 3. 检查送货单的用户ID是否在用户表中存在
console.log('【3】检查送货单用户ID是否匹配:');
allNotes.forEach(note => {
  const matchingUser = allUsers.find(u => u.id === note.user_id);
  if (matchingUser) {
    console.log(`✅ 送货单 ${note.no} 的用户ID (${note.user_id}) 匹配用户: ${matchingUser.username || matchingUser.phone}`);
  } else {
    console.log(`❌ 送货单 ${note.no} 的用户ID (${note.user_id}) 没有匹配的用户！`);
  }
});

// 4. 检查kaola用户
console.log('\n【4】查找kaola用户:');
const kaolaUsers = allUsers.filter(u => u.username === 'kaola' || u.phone === '13873121186');
if (kaolaUsers.length > 0) {
  kaolaUsers.forEach(user => {
    console.log(`找到用户: ID=${user.id}, 用户名=${user.username}, 手机=${user.phone}`);
    
    // 检查该用户的送货单
    const userNotes = db.prepare('SELECT * FROM delivery_notes WHERE user_id = ?').all(user.id);
    console.log(`该用户的送货单数量: ${userNotes.length}`);
    userNotes.forEach(note => {
      console.log(`  - 单号: ${note.no}, 客户: ${note.customer}`);
    });
  });
} else {
  console.log('❌ 未找到kaola用户！');
}

// 5. 模拟前端获取用户ID的逻辑
console.log('\n【5】模拟前端获取用户ID:');
console.log('前端会从localStorage中获取userInfo.id');
console.log('kaola用户登录后，localStorage应该存储:');
console.log('  userInfo.id = "USER_1776900041357"');
console.log('');
console.log('当前送货单的user_id = "USER_1776900041357"');
console.log('');
if (allNotes.some(note => note.user_id === 'USER_1776900041357')) {
  console.log('✅ 送货单的user_id与kaola用户ID匹配！');
} else {
  console.log('❌ 送货单的user_id与kaola用户ID不匹配！');
}

db.close();
console.log('\n数据库连接已关闭');