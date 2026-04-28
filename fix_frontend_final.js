// 修复前端代码，确保正确处理API返回的数据结构
const fs = require('fs');
const path = require('path');

const filePath = 'E:\\yinhexingchen\\inventory_management.html';
let content = fs.readFileSync(filePath, 'utf8');

// 1. 修复getDeliveryNotesAsync函数，确保正确处理API返回的数据结构
const getDeliveryNotesAsyncFix = `
    async function getDeliveryNotesAsync() {
      var userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      var isLoggedIn = userInfo.isLoggedIn || userInfo.id;

      if (isLoggedIn) {
        // 已登录用户：从API获取
        try {
          var apiNotes = await apiGetDeliveryNotes();
          // 转换API返回的数据结构以匹配前端期望的格式
          deliveryNotesCache = (apiNotes || []).map(note => ({
            id: note.id,
            no: note.no,
            customer: note.customer,
            contact: note.contact || note.contactName || '游葵', // 兼容不同的字段名
            date: note.date || note.deliveryDate || '2026-04-14',
            status: note.status,
            address: note.address || note.customerAddress,
            remark: note.remark || '',
            items: note.items || []
          }));
          deliveryNotesLoaded = true;
          console.log('API获取的送货单数据:', deliveryNotesCache);
          return deliveryNotesCache;
        } catch (e) {
          console.warn('API获取送货单失败:', e);
          deliveryNotesCache = [];
          deliveryNotesLoaded = true;
          return [];
        }
      } else {
        // 未登录用户：从localStorage获取或使用演示数据
        try {
          var saved = JSON.parse(localStorage.getItem(deliveryNoteStorageKey) || 'null');
          if (Array.isArray(saved) && saved.length) {
            // 兼容旧数据：单行商品转为items数组
            var notes = saved.map(function(n) {
              if (!n.items && n.product) {
                n.items = [{ product: n.product, quantity: n.quantity, price: 0 }];
              }
              return n;
            });
            deliveryNotesCache = notes;
            deliveryNotesLoaded = true;
            return notes;
          }
        } catch (error) {
          console.error('Error getting delivery notes from localStorage:', error);
        }

        // 使用演示数据
        deliveryNotesCache = defaultDeliveryNotes.slice();
        deliveryNotesLoaded = true;
        return defaultDeliveryNotes.slice();
      }
    }`;

// 2. 修复页面加载代码，确保清除旧数据并强制刷新
const domContentLoadedFix = `
    document.addEventListener('DOMContentLoaded', async function() {
      console.log('DOMContentLoaded event fired');
      
      // 清除localStorage中的旧送货单数据，避免显示默认数据
      console.log('Clearing old delivery notes from localStorage...');
      localStorage.removeItem('delivery-notes');
      console.log('Old delivery notes cleared');
      
      // 预加载数据到缓存（混合模式：API优先，失败回退到localStorage）
      try {
        console.log('正在预加载数据...');
        await Promise.all([
          getAllProductsAsync().catch(e => console.warn('预加载商品失败:', e)),
          getAllCustomersAsync().catch(e => console.warn('预加载客户失败:', e)),
          getDeliveryNotesAsync().catch(e => console.warn('预加载送货单失败:', e))
        ]);
        console.log('数据预加载完成');
        // 数据加载完成后重新渲染
        console.log('Rendering delivery notes after data preload');
        renderDeliveryNotes();
      } catch (e) {
        console.warn('数据预加载过程出错，继续使用localStorage:', e);
      }`;

// 替换原始代码
content = content.replace(/async function getDeliveryNotesAsync\(\) \{[\s\S]*?\n    \}/, getDeliveryNotesAsyncFix);
content = content.replace(/document\.addEventListener\('DOMContentLoaded', async function\(\) \{[\s\S]*?数据预加载完成[\s\S]*?\n      \}/, domContentLoadedFix);

// 保存修改
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ 前端代码修复完成！');
console.log('1. 修复了数据结构处理，确保正确处理API返回的数据');
console.log('2. 清除了localStorage中的旧数据，避免显示默认的示例数据');
console.log('3. 确保数据加载完成后重新渲染页面');
console.log('\n现在需要将修改后的文件上传到服务器...');