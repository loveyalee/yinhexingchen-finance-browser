/**
 * 客户管理页面 JavaScript
 */

var customerStorageKey = 'inventoryCustomers';
var customersCache = null;
var customersLoaded = false;

// ==================== API调用辅助函数 ====================
function getCurrentUserId() {
  try {
    var userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    return userInfo.id || '';
  } catch (e) {
    return '';
  }
}

async function apiGetCustomers() {
  try {
    var userId = getCurrentUserId();
    var response = await fetch('/api/customers?userId=' + encodeURIComponent(userId));
    var data = await response.json();
    if (data.success) {
      return data.data;
    }
    return [];
  } catch (e) {
    console.error('获取客户列表失败:', e);
    return [];
  }
}

async function apiAddCustomer(customer) {
  try {
    var userId = getCurrentUserId();
    var response = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...customer, userId: userId })
    });
    var data = await response.json();
    return data;
  } catch (e) {
    console.error('添加客户失败:', e);
    return { success: false, message: '添加客户失败' };
  }
}

async function apiUpdateCustomer(customer) {
  try {
    var response = await fetch('/api/customers', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customer)
    });
    var data = await response.json();
    return data;
  } catch (e) {
    console.error('更新客户失败:', e);
    return { success: false, message: '更新客户失败' };
  }
}

async function apiDeleteCustomer(id) {
  try {
    var response = await fetch('/api/customers', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id })
    });
    var data = await response.json();
    return data;
  } catch (e) {
    console.error('删除客户失败:', e);
    return { success: false, message: '删除客户失败' };
  }
}

// ==================== 客户管理功能 ====================
async function getAllCustomersAsync() {
  try {
    console.log('从API获取客户数据...');
    var apiCustomers = await apiGetCustomers();
    customersCache = apiCustomers || [];
    customersLoaded = true;
    console.log('API返回客户数量:', customersCache.length);
    return customersCache;
  } catch (e) {
    console.error('API获取客户失败:', e);
    customersCache = [];
    customersLoaded = true;
    return [];
  }
}

function getAllCustomers() {
  if (customersLoaded && customersCache) {
    return customersCache;
  }
  if (!customersLoaded) {
    getAllCustomersAsync().then(() => {
      renderCustomersTable();
    });
  }
  return customersCache || [];
}

function saveCustomers(customers) {
  customersCache = customers;
  customersLoaded = true;
  var userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  var isLoggedIn = userInfo.isLoggedIn || userInfo.id;
  if (!isLoggedIn) {
    localStorage.setItem(customerStorageKey, JSON.stringify(customers));
  }
}

// 渲染客户表格
function renderCustomersTable() {
  var tbody = document.getElementById('customers-tbody');
  if (!tbody) return;

  var customers = getAllCustomers();

  if (customers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-text">暂无客户数据，请点击"新增客户"添加</td></tr>';
    return;
  }

  var html = customers.map(function(customer, index) {
    return '<tr>' +
      '<td><input type="checkbox" class="customer-checkbox" data-index="' + index + '" data-id="' + (customer.id || '') + '"></td>' +
      '<td>' + (customer.name || '') + '</td>' +
      '<td>' + (customer.contact || '') + '</td>' +
      '<td>' + (customer.phone || '') + '</td>' +
      '<td>' + (customer.address || '') + '</td>' +
      '<td>' +
        '<button class="btn btn-sm btn-primary" onclick="openEditCustomerModal(' + index + ')">编辑</button> ' +
        '<button class="btn btn-sm btn-danger" onclick="deleteCustomerRow(' + index + ')">删除</button>' +
      '</td>' +
    '</tr>';
  }).join('');

  tbody.innerHTML = html;
}

// 打开新增客户弹窗
window.openAddCustomerModal = function() {
  document.getElementById('customer-modal-title').textContent = '新增客户';
  document.getElementById('customer-edit-index').value = '';
  document.getElementById('customer-name').value = '';
  document.getElementById('customer-contact').value = '';
  document.getElementById('customer-phone').value = '';
  document.getElementById('customer-address').value = '';
  document.getElementById('customer-remark').value = '';
  document.getElementById('customer-edit-modal').classList.add('show');
  document.getElementById('customer-name').focus();
};

// 打开编辑客户弹窗
window.openEditCustomerModal = function(index) {
  var customers = getAllCustomers();
  var customer = customers[index];
  if (!customer) return;

  document.getElementById('customer-modal-title').textContent = '编辑客户';
  document.getElementById('customer-edit-index').value = index;
  document.getElementById('customer-name').value = customer.name || '';
  document.getElementById('customer-contact').value = customer.contact || '';
  document.getElementById('customer-phone').value = customer.phone || '';
  document.getElementById('customer-address').value = customer.address || '';
  document.getElementById('customer-remark').value = customer.remark || '';
  document.getElementById('customer-edit-modal').classList.add('show');
  document.getElementById('customer-name').focus();
};

// 关闭客户弹窗
window.closeCustomerModal = function() {
  document.getElementById('customer-edit-modal').classList.remove('show');
};

// 从表单保存客户
window.saveCustomerFromForm = async function() {
  var index = document.getElementById('customer-edit-index').value;
  var name = document.getElementById('customer-name').value.trim();
  var contact = document.getElementById('customer-contact').value.trim();
  var phone = document.getElementById('customer-phone').value.trim();
  var address = document.getElementById('customer-address').value.trim();
  var remark = document.getElementById('customer-remark').value.trim();

  if (!name) {
    alert('请输入客户名称');
    return;
  }

  var userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  var isLoggedIn = userInfo.isLoggedIn || userInfo.id;

  if (isLoggedIn) {
    // 已登录用户：通过API操作
    try {
      if (index === '') {
        // 新增
        var result = await apiAddCustomer({ name: name, contact: contact, phone: phone, address: address, remark: remark });
        if (result.success) {
          customersLoaded = false;
          await getAllCustomersAsync();
          renderCustomersTable();
          closeCustomerModal();
          alert('客户添加成功');
        } else {
          alert(result.message || '添加失败');
        }
      } else {
        // 编辑
        var customers = getAllCustomers();
        var customer = customers[parseInt(index)];
        if (customer && customer.id) {
          var result = await apiUpdateCustomer({ id: customer.id, name: name, contact: contact, phone: phone, address: address, remark: remark });
          if (result.success) {
            customersLoaded = false;
            await getAllCustomersAsync();
            renderCustomersTable();
            closeCustomerModal();
            alert('客户修改成功');
          } else {
            alert(result.message || '修改失败');
          }
        }
      }
    } catch (e) {
      console.error('保存客户失败:', e);
      alert('保存失败，请重试');
    }
  } else {
    // 未登录用户：localStorage操作
    var customers = getAllCustomers();
    var existingIndex = customers.findIndex(function(c) { return c.name === name; });

    if (index === '') {
      if (existingIndex !== -1) {
        alert('客户名称已存在');
        return;
      }
      customers.push({ name: name, contact: contact, phone: phone, address: address, remark: remark });
    } else {
      var editIndex = parseInt(index);
      if (existingIndex !== -1 && existingIndex !== editIndex) {
        alert('客户名称已存在');
        return;
      }
      customers[editIndex] = { name: name, contact: contact, phone: phone, address: address, remark: remark };
    }

    saveCustomers(customers);
    renderCustomersTable();
    closeCustomerModal();
    alert(index === '' ? '客户添加成功' : '客户修改成功');
  }
};

// 删除客户行
window.deleteCustomerRow = async function(index) {
  var customers = getAllCustomers();
  var customer = customers[index];
  if (!customer) return;

  if (!confirm('确定要删除客户"' + customer.name + '"吗？')) return;

  var userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  var isLoggedIn = userInfo.isLoggedIn || userInfo.id;

  if (isLoggedIn && customer.id) {
    try {
      var result = await apiDeleteCustomer(customer.id);
      if (result.success) {
        customersLoaded = false;
        await getAllCustomersAsync();
        renderCustomersTable();
        alert('客户已删除');
      } else {
        alert(result.message || '删除失败');
      }
    } catch (e) {
      console.error('删除客户失败:', e);
      alert('删除失败，请重试');
    }
  } else {
    customers.splice(index, 1);
    saveCustomers(customers);
    renderCustomersTable();
    alert('客户已删除');
  }
};

// 全选/取消全选
window.toggleSelectAllCustomers = function() {
  var selectAllCheckbox = document.getElementById('select-all-customers');
  var customerCheckboxes = document.querySelectorAll('.customer-checkbox');
  var allChecked = true;
  customerCheckboxes.forEach(function(checkbox) {
    if (!checkbox.checked) allChecked = false;
  });
  var newChecked = !allChecked;
  selectAllCheckbox.checked = newChecked;
  customerCheckboxes.forEach(function(checkbox) {
    checkbox.checked = newChecked;
  });
};

// 批量删除客户
window.batchDeleteCustomers = async function() {
  var customerCheckboxes = document.querySelectorAll('.customer-checkbox:checked');
  console.log('选中的客户数量:', customerCheckboxes.length);

  if (customerCheckboxes.length === 0) {
    alert('请先选择要删除的客户');
    return;
  }

  if (!confirm('确定要删除选中的 ' + customerCheckboxes.length + ' 个客户吗？')) return;

  var userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  var isLoggedIn = userInfo.isLoggedIn || userInfo.id;

  if (isLoggedIn) {
    var deletePromises = [];
    customerCheckboxes.forEach(function(checkbox) {
      var customerId = checkbox.getAttribute('data-id');
      if (customerId) {
        deletePromises.push(apiDeleteCustomer(customerId));
      }
    });

    if (deletePromises.length === 0) {
      alert('没有找到有效的客户ID，请刷新页面重试');
      return;
    }

    try {
      var results = await Promise.all(deletePromises);
      customersLoaded = false;
      await getAllCustomersAsync();
      renderCustomersTable();
      alert('已删除 ' + deletePromises.length + ' 个客户');
    } catch (e) {
      console.error('批量删除失败:', e);
      alert('删除失败，请重试');
    }
  } else {
    var customers = getAllCustomers();
    var indicesToDelete = [];
    customerCheckboxes.forEach(function(checkbox) {
      indicesToDelete.push(parseInt(checkbox.getAttribute('data-index')));
    });
    indicesToDelete.sort(function(a, b) { return b - a; });

    indicesToDelete.forEach(function(index) {
      customers.splice(index, 1);
    });

    saveCustomers(customers);
    renderCustomersTable();
    alert('已删除 ' + customerCheckboxes.length + ' 个客户');
  }
};

// 页面初始化
document.addEventListener('DOMContentLoaded', async function() {
  try {
    await getAllCustomersAsync();
    renderCustomersTable();
  } catch (e) {
    console.error('初始化失败:', e);
  }
});