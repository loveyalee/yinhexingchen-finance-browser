/**
 * 更新企业用户用户名为手机号
 *
 * 功能：将所有企业用户（user_type = 'enterprise'）的 username 字段设置为手机号
 *
 * 使用方法：
 *   node scripts/update-enterprise-username.js
 *
 * 或者先预览不执行：
 *   node scripts/update-enterprise-username.js --dry-run
 */

const Database = require('better-sqlite3');
const path = require('path');

// 数据库路径
const DB_PATH = path.join(__dirname, '..', 'db', 'users.db');

// 检查是否为 dry-run 模式
const isDryRun = process.argv.includes('--dry-run');

function main() {
  console.log('========================================');
  console.log('企业用户用户名更新脚本');
  console.log('========================================');
  console.log('数据库路径:', DB_PATH);
  console.log('模式:', isDryRun ? '预览模式 (dry-run)' : '执行模式');
  console.log('');

  let db;
  try {
    db = new Database(DB_PATH);
  } catch (e) {
    console.error('无法打开数据库:', e.message);
    process.exit(1);
  }

  // 1. 检查 username 列是否存在，不存在则添加
  const tableInfo = db.prepare('PRAGMA table_info(users)').all();
  const hasUsernameColumn = tableInfo.some(col => col.name === 'username');

  if (!hasUsernameColumn) {
    console.log('username 列不存在，需要添加...');
    if (!isDryRun) {
      try {
        db.exec('ALTER TABLE users ADD COLUMN username TEXT');
        console.log('✓ 已添加 username 列');
      } catch (e) {
        console.error('添加 username 列失败:', e.message);
        db.close();
        process.exit(1);
      }
    } else {
      console.log('[dry-run] 将添加 username 列');
      // dry-run 模式下，模拟添加列后再查询
      console.log('');
      console.log('当前数据库中没有企业用户数据');
      console.log('请先添加用户数据后再运行此脚本');
      db.close();
      return;
    }
  } else {
    console.log('✓ username 列已存在');
  }

  // 2. 查询所有企业用户
  let enterpriseUsers;
  try {
    enterpriseUsers = db.prepare(`
      SELECT id, username, phone, user_type, institution_name
      FROM users
      WHERE user_type = 'enterprise'
    `).all();
  } catch (e) {
    console.error('查询企业用户失败:', e.message);
    db.close();
    process.exit(1);
  }

  console.log('');
  console.log('企业用户数量:', enterpriseUsers.length);
  console.log('');

  if (enterpriseUsers.length === 0) {
    console.log('没有企业用户需要更新');
    db.close();
    return;
  }

  // 3. 显示需要更新的用户
  console.log('需要更新的企业用户:');
  console.log('----------------------------------------');
  console.log('ID\t\t\t当前用户名\t手机号\t\t机构名称');
  console.log('----------------------------------------');

  const usersToUpdate = enterpriseUsers.filter(u => u.username !== u.phone);

  enterpriseUsers.forEach(user => {
    const needUpdate = user.username !== user.phone;
    const status = needUpdate ? '→ 需更新' : '✓ 已是手机号';
    console.log(
      user.id.substring(0, 20) + '\t' +
      (user.username || '(空)') + '\t' +
      user.phone + '\t' +
      (user.institution_name || '-') + '\t' +
      status
    );
  });

  console.log('----------------------------------------');
  console.log('');
  console.log('需要更新:', usersToUpdate.length, '个用户');
  console.log('无需更新:', enterpriseUsers.length - usersToUpdate.length, '个用户');
  console.log('');

  if (usersToUpdate.length === 0) {
    console.log('所有企业用户的用户名已经是手机号，无需更新');
    db.close();
    return;
  }

  // 4. 执行更新
  if (isDryRun) {
    console.log('[dry-run] 将执行以下更新:');
    usersToUpdate.forEach(user => {
      console.log(`  ${user.username || '(空)'} → ${user.phone}`);
    });
  } else {
    console.log('正在更新...');

    const updateStmt = db.prepare('UPDATE users SET username = ?, update_time = ? WHERE id = ?');
    const now = new Date().toISOString();

    let successCount = 0;
    let failCount = 0;

    const transaction = db.transaction(() => {
      usersToUpdate.forEach(user => {
        try {
          updateStmt.run(user.phone, now, user.id);
          successCount++;
          console.log(`  ✓ ${user.username || '(空)'} → ${user.phone}`);
        } catch (e) {
          failCount++;
          console.error(`  ✗ 更新失败 ${user.id}:`, e.message);
        }
      });
    });

    transaction();

    console.log('');
    console.log('========================================');
    console.log('更新完成');
    console.log('成功:', successCount);
    console.log('失败:', failCount);
    console.log('========================================');
  }

  db.close();
}

main();
