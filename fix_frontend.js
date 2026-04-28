// 修复前端代码，使其与API返回的数据结构匹配
const fs = require('fs');
const path = require('path');

const filePath = 'E:\\yinhexingchen\\inventory_management.html';
let content = fs.readFileSync(filePath, 'utf8');

// 1. 修复getDeliveryNotesAsync函数，确保API返回的数据结构正确转换
const getDeliveryNotesAsyncFix = `
    async function getDeliveryNotesAsync() {
      var userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      var isLoggedIn = userInfo.isLoggedIn || userInfo.id;

      if (isLoggedIn) {
        // 已登录用户：从API获取
        try {
          var apiNotes = await apiGetDeliveryNotes();
          // 转换API返回的数据结构以匹配前端期望的格式
          deliveryNotesCache = (apiNotes || []).map(note => {
            // 转换items数据结构
            let items = [];
            try {
              items = JSON.parse(note.items || '[]').map(item => ({
                product: item.productName || item.product || '商品',
                quantity: item.quantity || 0,
                price: item.unitPrice || item.price || 0
              }));
            } catch (e) {
              console.warn('解析items失败:', e);
              items = [];
            }
            return {
              id: note.id,
              no: note.no,
              customer: note.customer,
              contact: note.contact,
              date: note.date,
              status: note.status,
              address: note.address,
              remark: note.remark,
              items: items
            };
          });
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

// 2. 修复getDeliveryNotes函数，确保在缓存为空时调用异步获取
const getDeliveryNotesFix = `
    function getDeliveryNotes() {
      // 同步版本，优先使用缓存
      if (deliveryNotesLoaded && deliveryNotesCache) {
        console.log('getDeliveryNotes: returning cached data, count:', deliveryNotesCache.length);
        return deliveryNotesCache;
      }

      var userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      var isLoggedIn = userInfo.isLoggedIn || userInfo.id;

      if (isLoggedIn) {
        // 已登录用户：如果缓存为空，触发异步获取并返回空数组
        if (!deliveryNotesLoaded) {
          console.log('getDeliveryNotes: cache not loaded, triggering async fetch');
          // 触发异步获取，但同步返回空数组
          getDeliveryNotesAsync().then(() => {
            console.log('Async fetch completed, re-rendering');
            renderDeliveryNotes();
          });
        }
        console.log('getDeliveryNotes: logged in user, returning cache:', deliveryNotesCache ? deliveryNotesCache.length : 0);
        return deliveryNotesCache || [];
      } else {
        // 未登录用户：从localStorage获取或使用演示数据
        try {
          var saved = JSON.parse(localStorage.getItem(deliveryNoteStorageKey) || 'null');
          if (Array.isArray(saved) && saved.length) {
            return saved.map(function(n) {
              if (!n.items && n.product) {
                n.items = [{ product: n.product, quantity: n.quantity, price: 0 }];
              }
              return n;
            });
          }
        } catch (error) {
          console.error('Error getting delivery notes from localStorage:', error);
        }

        return defaultDeliveryNotes.slice();
      }
    }`;

// 3. 修复页面加载代码，确保在DOMContentLoaded后重新渲染
const domContentLoadedFix = `
    document.addEventListener('DOMContentLoaded', async function() {
      console.log('DOMContentLoaded event fired');
      
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
content = content.replace(/function getDeliveryNotes\(\) \{[\s\S]*?\n    \}/, getDeliveryNotesFix);
content = content.replace(/document\.addEventListener\('DOMContentLoaded', async function\(\) \{[\s\S]*?数据预加载完成[\s\S]*?\n      \}/, domContentLoadedFix);

// 保存修改
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ 前端代码修复完成！');
console.log('1. 修复了数据结构转换，使API返回的数据与前端期望的格式匹配');
console.log('2. 修复了缓存机制，确保在缓存为空时触发异步获取');
console.log('3. 修复了页面加载逻辑，确保数据加载完成后重新渲染');
console.log('\n现在需要将修改后的文件上传到服务器...');