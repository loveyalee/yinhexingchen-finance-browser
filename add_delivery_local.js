// 添加送货单到本地SQLite数据库
const Database = require('better-sqlite3');
const path = require('path');

// 数据库配置
const dbPath = 'E:\\yinhexingchen\\db\\users.db';
const db = new Database(dbPath);

// 送货单数据
const deliveryData = {
  no: 'SHD20260414514',
  customer: '长沙市长腾物业管理有限公司望城分公司',
  contact: '游葵',
  contactPhone: '18975152694',
  address: '长沙市望城经济技术开发区同心路与马桥河路交汇处东北角金星珑湾',
  date: '2026-04-14',
  status: '待送达',
  remark: '',
  items: JSON.stringify([
    {
      productName: '灯管',
      model: 'T8',
      length: '1.2m',
      wattage: '5W',
      singleDouble: '单亮',
      induction: '雷达感应',
      quantity: 120,
      unit: '支',
      unitPrice: 17.05,
      amount: 2046.00
    }
  ])
};

// kaola用户的ID
const kaolaUserId = 'USER_1776900041357';

async function main() {
  try {
    console.log('=== 检查本地SQLite数据库 ===');

    // 检查表是否存在
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='delivery_notes'").all();
    console.log('找到的表:', tables);

    // 检查kaola用户
    const users = db.prepare('SELECT * FROM users WHERE username = ?').all('kaola');
    console.log('\n=== kaola用户 ===');
    if (users.length > 0) {
      console.log('kaola用户信息:');
      console.log('- ID:', users[0].id);
      console.log('- 用户名:', users[0].username);
      console.log('- 手机号:', users[0].phone);
    } else {
      console.log('kaola用户不存在！');
    }

    // 检查是否已有送货单
    console.log('\n=== 检查现有送货单 ===');
    const existingNotes = db.prepare('SELECT * FROM delivery_notes WHERE no = ?').all('SHD20260414514');
    console.log('现有的SHD20260414514送货单数量:', existingNotes.length);
    if (existingNotes.length > 0) {
      console.log('送货单已存在:', existingNotes[0]);
    }

    // 检查kaola用户的送货单
    console.log('\n=== kaola用户的送货单 ===');
    const kaolaNotes = db.prepare('SELECT * FROM delivery_notes WHERE user_id = ?').all(kaolaUserId);
    console.log('kaola用户的送货单数量:', kaolaNotes.length);

    // 如果送货单已存在但不属于kaola，先删除
    if (existingNotes.length > 0 && existingNotes[0].user_id !== kaolaUserId) {
      console.log('删除不属于kaola的送货单...');
      db.prepare('DELETE FROM delivery_notes WHERE no = ?').run('SHD20260414514');
      console.log('删除完成');
    }

    // 添加或更新送货单
    console.log('\n=== 添加/更新送货单 ===');

    // 检查当前是否还有这条送货单
    const currentNotes = db.prepare('SELECT * FROM delivery_notes WHERE no = ?').all('SHD20260414514');

    if (currentNotes.length > 0) {
      // 更新现有送货单
      console.log('更新现有送货单...');
      const now = new Date().toISOString();
      const stmt = db.prepare(`
        UPDATE delivery_notes SET
          customer = ?,
          contact = ?,
          contact_phone = ?,
          address = ?,
          date = ?,
          status = ?,
          remark = ?,
          items = ?,
          user_id = ?,
          update_time = ?
        WHERE no = ?
      `);
      stmt.run(
        deliveryData.customer,
        deliveryData.contact,
        deliveryData.contactPhone,
        deliveryData.address,
        deliveryData.date,
        deliveryData.status,
        deliveryData.remark,
        deliveryData.items,
        kaolaUserId,
        now,
        'SHD20260414514'
      );
      console.log('送货单更新成功！');
    } else {
      // 添加新送货单
      console.log('添加新送货单...');
      const now = new Date().toISOString();
      const stmt = db.prepare(`
        INSERT INTO delivery_notes (no, customer, contact, contact_phone, date, status, address, remark, items, user_id, create_time, update_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        deliveryData.no,
        deliveryData.customer,
        deliveryData.contact,
        deliveryData.contactPhone,
        deliveryData.date,
        deliveryData.status,
        deliveryData.address,
        deliveryData.remark,
        deliveryData.items,
        kaolaUserId,
        now,
        now
      );
      console.log('送货单添加成功！');
    }

    // 验证结果
    console.log('\n=== 最终验证 ===');
    const finalNotes = db.prepare('SELECT * FROM delivery_notes WHERE user_id = ?').all(kaolaUserId);
    console.log('kaola用户的送货单数量:', finalNotes.length);
    if (finalNotes.length > 0) {
      finalNotes.forEach((note, index) => {
        console.log(`\n送货单 ${index + 1}:`);
        console.log('- 单号:', note.no);
        console.log('- 客户:', note.customer);
        console.log('- 联系人:', note.contact);
        console.log('- 电话:', note.contact_phone);
        console.log('- 地址:', note.address);
        console.log('- 日期:', note.date);
        console.log('- 金额:', note.items ? JSON.parse(note.items).reduce((sum, item) => sum + item.amount, 0) : 0);
        console.log('- 状态:', note.status);
        console.log('- 用户ID:', note.user_id);
      });
    }

    console.log('\n✅ 操作完成！');

  } catch (error) {
    console.error('操作失败:', error.message);
    console.error('错误堆栈:', error.stack);
  } finally {
    db.close();
    console.log('\n数据库连接已关闭');
  }
}

main();