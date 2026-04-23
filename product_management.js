/**
 * 商品管理页面 JavaScript
 */

// 预设商品数据
var productDatabase = [
  { name: '财务软件专业版', code: 'SP001', category: '软件', unit: '套', price: 2999 },
  { name: '财务软件标准版', code: 'SP002', category: '软件', unit: '套', price: 1999 },
  { name: '财务软件基础版', code: 'SP003', category: '软件', unit: '套', price: 999 },
  { name: '税务筹划服务', code: 'SP004', category: '服务', unit: '次', price: 1500 },
  { name: '财务咨询服务', code: 'SP005', category: '服务', unit: '次', price: 2000 },
  { name: '审计服务', code: 'SP006', category: '服务', unit: '次', price: 3000 },
  { name: '代理记账服务', code: 'SP007', category: '服务', unit: '月', price: 500 },
  { name: '会计培训课程', code: 'SP008', category: '课程', unit: '套', price: 999 },
  { name: '税务培训课程', code: 'SP009', category: '课程', unit: '套', price: 1299 },
  { name: '财务模板包', code: 'SP010', category: '模板', unit: '套', price: 199 },
  { name: '税务申报模板', code: 'SP011', category: '模板', unit: '套', price: 99 },
  { name: '财务报表模板', code: 'SP012', category: '模板', unit: '套', price: 149 },
  { name: '发票打印机', code: 'SP013', category: '硬件', unit: '台', price: 2500 },
  { name: '财务专用扫描仪', code: 'SP014', category: '硬件', unit: '台', price: 1800 },
  { name: '凭证装订机', code: 'SP015', category: '硬件', unit: '台', price: 800 }
];

var productStorageKey = 'inventoryProducts';
var productsCache = null;
var productsLoaded = false;

// ==================== API调用辅助函数 ====================
function getCurrentUserId() {
  try {
    var userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    return userInfo.id || '';
  } catch (e) {
    return '';
  }
}

async function apiGetProducts() {
  try {
    var userId = getCurrentUserId();
    var response = await fetch('/api/products?userId=' + encodeURIComponent(userId));
    var data = await response.json();
    if (data.success) {
      return data.data;
    }
    return [];
  } catch (e) {
    console.error('获取商品列表失败:', e);
    return [];
  }
}

async function apiAddProduct(product) {
  try {
    var userId = getCurrentUserId();
    var response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...product, userId: userId })
    });
    var data = await response.json();
    return data;
  } catch (e) {
    console.error('添加商品失败:', e);
    return { success: false, message: '添加商品失败' };
  }
}

async function apiUpdateProduct(product) {
  try {
    var response = await fetch('/api/products', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    });
    var data = await response.json();
    return data;
  } catch (e) {
    console.error('更新商品失败:', e);
    return { success: false, message: '更新商品失败' };
  }
}

async function apiDeleteProduct(id) {
  try {
    var response = await fetch('/api/products', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id })
    });
    var data = await response.json();
    return data;
  } catch (e) {
    console.error('删除商品失败:', e);
    return { success: false, message: '删除商品失败' };
  }
}

// ==================== 商品管理功能 ====================
async function getAllProductsAsync() {
  try {
    console.log('从API获取商品数据...');
    var apiProducts = await apiGetProducts();
    productsCache = apiProducts || [];
    productsLoaded = true;
    console.log('API返回商品数量:', productsCache.length);
    return productsCache;
  } catch (e) {
    console.error('API获取商品失败:', e);
    productsCache = [];
    productsLoaded = true;
    return [];
  }
}

function getAllProducts() {
  if (productsLoaded && productsCache) {
    return productsCache;
  }
  if (!productsLoaded) {
    getAllProductsAsync().then(() => {
      renderProductsTable();
    });
  }
  return productsCache || [];
}

async function saveProductsAsync(products) {
  productsCache = products;
  productsLoaded = true;
  var userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  var isLoggedIn = userInfo.isLoggedIn || userInfo.id;
  if (!isLoggedIn) {
    localStorage.setItem(productStorageKey, JSON.stringify(products));
  }
}

function saveProducts(products) {
  productsCache = products;
  productsLoaded = true;
  var userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  var isLoggedIn = userInfo.isLoggedIn || userInfo.id;
  if (!isLoggedIn) {
    localStorage.setItem(productStorageKey, JSON.stringify(products));
  }
}

// 渲染商品表格
function renderProductsTable() {
  var tbody = document.getElementById('products-tbody');
  if (!tbody) return;

  var products = getAllProducts();

  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-text">暂无商品数据，请点击"新增商品"添加</td></tr>';
    return;
  }

  var html = products.map(function(product, index) {
    return '<tr>' +
      '<td><input type="checkbox" class="product-checkbox" data-index="' + index + '" data-id="' + (product.id || '') + '"></td>' +
      '<td>' + (product.code || '') + '</td>' +
      '<td>' + (product.name || '') + '</td>' +
      '<td>' + (product.category || '') + '</td>' +
      '<td>' + (product.unit || '') + '</td>' +
      '<td>¥' + (product.price || 0).toFixed(2) + '</td>' +
      '<td>' +
        '<button class="btn btn-sm btn-primary" onclick="openEditProductModal(' + index + ')">编辑</button> ' +
        '<button class="btn btn-sm btn-danger" onclick="deleteProductRow(' + index + ')">删除</button>' +
      '</td>' +
    '</tr>';
  }).join('');

  tbody.innerHTML = html;
}

// 打开新增商品弹窗
window.openAddProductModal = function() {
  document.getElementById('product-modal-title').textContent = '新增商品';
  document.getElementById('product-edit-index').value = '';
  document.getElementById('product-name').value = '';
  document.getElementById('product-code').value = '';
  document.getElementById('product-category').value = '软件';
  document.getElementById('product-unit').value = '';
  document.getElementById('product-price').value = '';
  document.getElementById('product-edit-modal').classList.add('show');
  document.getElementById('product-name').focus();
};

// 打开编辑商品弹窗
window.openEditProductModal = function(index) {
  var products = getAllProducts();
  var product = products[index];
  if (!product) return;

  document.getElementById('product-modal-title').textContent = '编辑商品';
  document.getElementById('product-edit-index').value = index;
  document.getElementById('product-name').value = product.name || '';
  document.getElementById('product-code').value = product.code || '';
  document.getElementById('product-category').value = product.category || '软件';
  document.getElementById('product-unit').value = product.unit || '';
  document.getElementById('product-price').value = product.price || '';
  document.getElementById('product-edit-modal').classList.add('show');
  document.getElementById('product-name').focus();
};

// 关闭商品弹窗
window.closeProductModal = function() {
  document.getElementById('product-edit-modal').classList.remove('show');
};

// 从表单保存商品
window.saveProductFromForm = async function() {
  var index = document.getElementById('product-edit-index').value;
  var name = document.getElementById('product-name').value.trim();
  var code = document.getElementById('product-code').value.trim();
  var category = document.getElementById('product-category').value;
  var unit = document.getElementById('product-unit').value.trim();
  var price = parseFloat(document.getElementById('product-price').value) || 0;

  if (!name) {
    alert('请输入商品名称');
    return;
  }

  var userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  var isLoggedIn = userInfo.isLoggedIn || userInfo.id;

  if (isLoggedIn) {
    // 已登录用户：通过API操作
    try {
      if (index === '') {
        // 新增
        var result = await apiAddProduct({ name: name, code: code, category: category, unit: unit, price: price });
        if (result.success) {
          productsLoaded = false;
          await getAllProductsAsync();
          renderProductsTable();
          closeProductModal();
          alert('商品添加成功');
        } else {
          alert(result.message || '添加失败');
        }
      } else {
        // 编辑
        var products = getAllProducts();
        var product = products[parseInt(index)];
        if (product && product.id) {
          var result = await apiUpdateProduct({ id: product.id, name: name, code: code, category: category, unit: unit, price: price });
          if (result.success) {
            productsLoaded = false;
            await getAllProductsAsync();
            renderProductsTable();
            closeProductModal();
            alert('商品修改成功');
          } else {
            alert(result.message || '修改失败');
          }
        }
      }
    } catch (e) {
      console.error('保存商品失败:', e);
      alert('保存失败，请重试');
    }
  } else {
    // 未登录用户：localStorage操作
    var products = getAllProducts();
    var existingIndex = products.findIndex(function(p) { return p.name === name; });

    if (index === '') {
      if (existingIndex !== -1) {
        alert('商品名称已存在');
        return;
      }
      products.push({ name: name, code: code, category: category, unit: unit, price: price });
    } else {
      var editIndex = parseInt(index);
      if (existingIndex !== -1 && existingIndex !== editIndex) {
        alert('商品名称已存在');
        return;
      }
      products[editIndex] = { name: name, code: code, category: category, unit: unit, price: price };
    }

    saveProducts(products);
    renderProductsTable();
    closeProductModal();
    alert(index === '' ? '商品添加成功' : '商品修改成功');
  }
};

// 删除商品行
window.deleteProductRow = async function(index) {
  var products = getAllProducts();
  var product = products[index];
  if (!product) return;

  if (!confirm('确定要删除商品"' + product.name + '"吗？')) return;

  var userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  var isLoggedIn = userInfo.isLoggedIn || userInfo.id;

  if (isLoggedIn && product.id) {
    try {
      var result = await apiDeleteProduct(product.id);
      if (result.success) {
        productsLoaded = false;
        await getAllProductsAsync();
        renderProductsTable();
        alert('商品已删除');
      } else {
        alert(result.message || '删除失败');
      }
    } catch (e) {
      console.error('删除商品失败:', e);
      alert('删除失败，请重试');
    }
  } else {
    products.splice(index, 1);
    saveProducts(products);
    renderProductsTable();
    alert('商品已删除');
  }
};

// 全选/取消全选
window.toggleSelectAllProducts = function() {
  var selectAllCheckbox = document.getElementById('select-all-products');
  var productCheckboxes = document.querySelectorAll('.product-checkbox');
  var checked = selectAllCheckbox.checked;

  productCheckboxes.forEach(function(checkbox) {
    checkbox.checked = checked;
  });
};

// 批量删除商品
window.batchDeleteProducts = async function() {
  var productCheckboxes = document.querySelectorAll('.product-checkbox:checked');
  if (productCheckboxes.length === 0) {
    alert('请先选择要删除的商品');
    return;
  }

  if (!confirm('确定要删除选中的 ' + productCheckboxes.length + ' 个商品吗？')) return;

  var userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  var isLoggedIn = userInfo.isLoggedIn || userInfo.id;

  if (isLoggedIn) {
    var deletePromises = [];
    productCheckboxes.forEach(function(checkbox) {
      var productId = checkbox.getAttribute('data-id');
      if (productId) {
        deletePromises.push(apiDeleteProduct(productId));
      }
    });

    try {
      await Promise.all(deletePromises);
      productsLoaded = false;
      await getAllProductsAsync();
      renderProductsTable();
      alert('已删除 ' + productCheckboxes.length + ' 个商品');
    } catch (e) {
      console.error('批量删除失败:', e);
      alert('删除失败，请重试');
    }
  } else {
    var products = getAllProducts();
    var indicesToDelete = [];
    productCheckboxes.forEach(function(checkbox) {
      indicesToDelete.push(parseInt(checkbox.getAttribute('data-index')));
    });
    indicesToDelete.sort(function(a, b) { return b - a; });

    indicesToDelete.forEach(function(index) {
      products.splice(index, 1);
    });

    saveProducts(products);
    renderProductsTable();
    alert('已删除 ' + productCheckboxes.length + ' 个商品');
  }
};

// 子菜单切换
window.toggleSubmenu = function(element) {
  var parent = element.parentElement;
  parent.classList.toggle('active');
};

window.toggleMemberSubmenu = function(element) {
  var parent = element.parentElement;
  parent.classList.toggle('active');
};

// 退出登录
window.handleLogout = function() {
  localStorage.removeItem('userInfo');
  localStorage.removeItem('userProfile');
  window.location.href = 'login.html';
};

// 页面初始化
document.addEventListener('DOMContentLoaded', async function() {
  try {
    await getAllProductsAsync();
    renderProductsTable();
  } catch (e) {
    console.error('初始化失败:', e);
  }
});
