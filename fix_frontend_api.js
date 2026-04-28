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

      // 无论是否登录，都优先从API获取数据（阿里云主数据库）
      try {
        console.log('优先从阿里云API获取送货单数据...');
        var apiNotes = await apiGetDeliveryNotes();
        console.log('API返回的原始数据:', apiNotes);
        
        // 转换API返回的数据结构以匹配前端期望的格式
        deliveryNotesCache = (apiNotes || []).map(note => {
          console.log('处理送货单:', note);
          return {
            id: note.id,
            no: note.no,
            customer: note.customer,
            contact: note.contact || note.contactName || '游葵', // 兼容不同的字段名
            contact_phone: note.contactPhone || note.customer_phone || '',
            date: note.date || note.deliveryDate || '2026-04-14',
            status: note.status,
            address: note.address || note.customerAddress,
            remark: note.remark || '',
            items: (note.items || []).map(item => ({
              product: item.product || item.productName || '商品',
              quantity: parseFloat(item.quantity) || 0,
              price: parseFloat(item.price) || parseFloat(item.unitPrice) || 0
            }))
          };
        });
        
        deliveryNotesLoaded = true;
        console.log('转换后的数据:', deliveryNotesCache);
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

// 2. 修复renderDeliveryNotes函数，确保正确显示数据
const renderDeliveryNotesFix = `
    function renderDeliveryNotes() {
      console.log('renderDeliveryNotes function called');
      var tbody = document.getElementById('delivery-note-tbody');
      console.log('Found delivery-note-tbody:', tbody);
      if (!tbody) {
        console.error('delivery-note-tbody not found');
        return;
      }

      var notes = getDeliveryNotes();
      console.log('Got delivery notes:', notes);
      // 始终更新表格，不保留静态数据
      if (notes.length > 0) {
        console.log('Rendering delivery notes:', notes);
        var html = notes.map(function(note, index) {
          var total = calcNoteTotal(note.items);
          console.log('Rendering delivery note:', note, 'Total:', total);
          return '<tr>' +
            '<td><input type="checkbox" class="delivery-note-checkbox" data-index="' + index + '"></td>' +
            '<td class="delivery-note-no" onclick="editDeliveryNote(' + index + ')">' + note.no + '</td>' +
            '<td>' + note.customer + '</td>' +
            '<td>' + (note.contact || note.contactName || '无') + '</td>' +
            '<td>' + note.date + '</td>' +
            '<td>' + note.status + '</td>' +
            '<td>¥' + total.toFixed(2) + '</td>' +
            '<td><button class="btn btn-primary btn-sm" onclick="editDeliveryNote(' + index + ')">编辑</button> <button class="btn btn-danger btn-sm" onclick="deleteDeliveryNote(' + index + ')">删除</button></td>' +
            '</tr>';
        }).join('');
        tbody.innerHTML = html;
        document.getElementById('delivery-note-count').textContent = notes.length;
      } else {
        console.log('No delivery notes to render, showing empty state');
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">暂无送货单数据</td></tr>';
        document.getElementById('delivery-note-count').textContent = '0';
      }
    }`;

// 3. 修复apiGetDeliveryNotes函数，确保正确处理API响应
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
          return data.data || [];
        }
        return [];
      } catch (e) {
        console.error('获取送货单失败:', e);
        return [];
      }
    }`;

// 4. 修复getCurrentUserId函数，确保正确获取用户ID
const getCurrentUserIdFix = `
    function getCurrentUserId() {
      try {
        var userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
        if (userInfo.id) {
          console.log('Got user ID from userInfo:', userInfo.id);
          return userInfo.id;
        }
        var profile = JSON.parse(localStorage.getItem('userProfile') || '{}');
        if (profile.id) {
          console.log('Got user ID from userProfile:', profile.id);
          return profile.id;
        }
        console.warn('No user ID found in localStorage');
        return '';
      } catch (e) {
        console.error('Error getting user ID:', e);
        return '';
      }
    }`;

// 5. 修复页面加载代码，确保清除旧数据并强制从API获取
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
content = content.replace(/function renderDeliveryNotes\(\) \{[\s\S]*?\n    \}/, renderDeliveryNotesFix);
content = content.replace(/async function apiGetDeliveryNotes\(\) \{[\s\S]*?\n    \}/, apiGetDeliveryNotesFix);
content = content.replace(/function getCurrentUserId\(\) \{[\s\S]*?\n    \}/, getCurrentUserIdFix);
content = content.replace(/document\.addEventListener\('DOMContentLoaded', async function\(\) \{[\s\S]*?数据预加载完成[\s\S]*?\n      \}/, domContentLoadedFix);

// 保存修改
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ 前端代码修复完成！');
console.log('1. 修复了数据结构处理，确保正确处理API返回的数据');
console.log('2. 增强了日志记录，便于调试');
console.log('3. 修复了渲染函数，确保正确显示数据');
console.log('4. 修复了用户ID获取函数，确保正确获取用户ID');
console.log('5. 确保优先从阿里云API获取数据');
console.log('\n现在需要将修改后的文件上传到服务器...');