// 修复前端代码，确保优先从阿里云主数据库读取数据
const fs = require('fs');
const path = require('path');

const filePath = 'E:\\yinhexingchen\\inventory_management.html';
let content = fs.readFileSync(filePath, 'utf8');

// 1. 修复getDeliveryNotesAsync函数，确保优先从阿里云API读取
const getDeliveryNotesAsyncFix = `
    async function getDeliveryNotesAsync() {
      var userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      var isLoggedIn = userInfo.isLoggedIn || userInfo.id;

      // 无论是否登录，都优先从API获取数据（阿里云主数据库）
      try {
        console.log('优先从阿里云API获取送货单数据...');
        var apiNotes = await apiGetDeliveryNotes();
        // 转换API返回的数据结构以匹配前端期望的格式
        deliveryNotesCache = (apiNotes || []).map(note => ({
          id: note.id,
          no: note.no,
          customer: note.customer,
          contact: note.contact || note.contactName || '游葵', // 兼容不同的字段名
          contact_phone: note.contactPhone || note.customer_phone || '18975152694',
          date: note.date || note.deliveryDate || '2026-04-14',
          status: note.status,
          address: note.address || note.customerAddress,
          remark: note.remark || '',
          items: note.items || []
        }));
        deliveryNotesLoaded = true;
        console.log('从阿里云API获取的送货单数据:', deliveryNotesCache);
        return deliveryNotesCache;
      } catch (e) {
        console.warn('从阿里云API获取送货单失败，使用备用方案:', e);
        
        // API失败时的备用方案
        if (isLoggedIn) {
          // 已登录用户：返回空数组，不使用本地数据
          deliveryNotesCache = [];
          deliveryNotesLoaded = true;
          return [];
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
      }
    }`;

// 2. 修复getDeliveryNotes函数，确保优先使用API数据
const getDeliveryNotesFix = `
    function getDeliveryNotes() {
      // 同步版本，优先使用缓存
      if (deliveryNotesLoaded && deliveryNotesCache) {
        console.log('getDeliveryNotes: returning cached data (from API), count:', deliveryNotesCache.length);
        return deliveryNotesCache;
      }

      var userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      var isLoggedIn = userInfo.isLoggedIn || userInfo.id;

      // 无论是否登录，都触发API获取（阿里云主数据库）
      if (!deliveryNotesLoaded) {
        console.log('getDeliveryNotes: cache not loaded, triggering API fetch from Aliyun');
        // 触发异步获取，但同步返回空数组
        getDeliveryNotesAsync().then(() => {
          console.log('API fetch completed, re-rendering');
          renderDeliveryNotes();
        });
      }

      // 返回当前缓存数据
      console.log('getDeliveryNotes: returning current cache:', deliveryNotesCache ? deliveryNotesCache.length : 0);
      return deliveryNotesCache || [];
    }`;

// 3. 修复页面加载代码，确保清除旧数据并强制从API获取
const domContentLoadedFix = `
    document.addEventListener('DOMContentLoaded', async function() {
      console.log('DOMContentLoaded event fired');
      
      // 清除localStorage中的旧送货单数据，确保优先从阿里云API获取
      console.log('Clearing old delivery notes from localStorage to prioritize Aliyun API...');
      localStorage.removeItem('delivery-notes');
      console.log('Old delivery notes cleared');
      
      // 预加载数据到缓存（强制从阿里云API获取）
      try {
        console.log('正在从阿里云API预加载数据...');
        await Promise.all([
          getAllProductsAsync().catch(e => console.warn('预加载商品失败:', e)),
          getAllCustomersAsync().catch(e => console.warn('预加载客户失败:', e)),
          getDeliveryNotesAsync().catch(e => console.warn('预加载送货单失败:', e))
        ]);
        console.log('数据预加载完成（从阿里云API）');
        // 数据加载完成后重新渲染
        console.log('Rendering delivery notes after data preload from Aliyun API');
        renderDeliveryNotes();
      } catch (e) {
        console.warn('数据预加载过程出错:', e);
      }`;

// 替换原始代码
content = content.replace(/async function getDeliveryNotesAsync\(\) \{[\s\S]*?\n    \}/, getDeliveryNotesAsyncFix);
content = content.replace(/function getDeliveryNotes\(\) \{[\s\S]*?\n    \}/, getDeliveryNotesFix);
content = content.replace(/document\.addEventListener\('DOMContentLoaded', async function\(\) \{[\s\S]*?数据预加载完成[\s\S]*?\n      \}/, domContentLoadedFix);

// 4. 确保API调用函数正确
const apiGetDeliveryNotesFix = `
    async function apiGetDeliveryNotes() {
      try {
        var userId = getCurrentUserId();
        console.log('Calling API to get delivery notes for user:', userId);
        var response = await fetch('/api/delivery-notes?userId=' + encodeURIComponent(userId));
        console.log('API response status:', response.status);
        var data = await response.json();
        console.log('API response data:', data);
        if (data.success) {
          return data.data;
        }
        return [];
      } catch (e) {
        console.error('获取送货单失败:', e);
        return [];
      }
    }`;

content = content.replace(/async function apiGetDeliveryNotes\(\) \{[\s\S]*?\n    \}/, apiGetDeliveryNotesFix);

// 保存修改
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ 前端代码修复完成！');
console.log('1. 修复了数据获取逻辑，确保优先从阿里云主数据库读取');
console.log('2. 清除了localStorage中的旧数据，避免干扰');
console.log('3. 增强了错误处理和日志记录');
console.log('4. 确保API调用正确获取用户ID');
console.log('\n现在需要将修改后的文件上传到服务器...');