// 供应商管理页面 JavaScript

(function() {
  'use strict';

  // 获取当前用户
  function getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem('userInfo') || 'null');
    } catch (e) {
      return null;
    }
  }

  // 获取供应商列表
  function getSupplierList() {
    var user = getCurrentUser();
    var key = 'suppliers_' + (user ? user.id : 'guest');
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) {
      return [];
    }
  }

  // 保存供应商列表
  function saveSupplierList(list) {
    var user = getCurrentUser();
    var key = 'suppliers_' + (user ? user.id : 'guest');
    localStorage.setItem(key, JSON.stringify(list || []));
  }

  // 渲染供应商列表
  function renderSupplierList() {
    var list = getSupplierList();
    var tbody = document.getElementById('suppliers-tbody');
    if (!tbody) return;

    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-text">暂无供应商数据，点击右上角"新增供应商"添加</td></tr>';
      return;
    }

    var html = '';
    list.forEach(function(supplier, index) {
      html += '<tr data-index="' + index + '">';
      html += '<td><input type="checkbox" class="supplier-checkbox" value="' + index + '"></td>';
      html += '<td>' + escapeHtml(supplier.name || '') + '</td>';
      html += '<td>' + escapeHtml(supplier.contact || '') + '</td>';
      html += '<td>' + escapeHtml(supplier.phone || '') + '</td>';
      html += '<td>' + escapeHtml(supplier.product || '') + '</td>';
      html += '<td>' + escapeHtml(supplier.address || '') + '</td>';
      html += '<td>' + escapeHtml(supplier.coopType || '长期合作') + '</td>';
      html += '<td>';
      html += '<button class="btn btn-sm btn-primary" onclick="editSupplier(' + index + ')" style="margin-right:5px;">编辑</button>';
      html += '<button class="btn btn-sm btn-danger" onclick="deleteSupplier(' + index + ')">删除</button>';
      html += '</td>';
      html += '</tr>';
    });
    tbody.innerHTML = html;
  }

  // HTML转义
  function escapeHtml(text) {
    if (!text) return '';
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // 打开新增供应商弹窗
  window.openAddSupplierModal = function() {
    document.getElementById('supplier-modal-title').textContent = '新增供应商';
    document.getElementById('supplier-edit-index').value = '';
    document.getElementById('supplier-form').reset();
    document.getElementById('supplier-edit-modal').classList.add('show');
    document.getElementById('supplier-name').focus();
  };

  // 编辑供应商
  window.editSupplier = function(index) {
    var list = getSupplierList();
    var supplier = list[index];
    if (!supplier) return;

    document.getElementById('supplier-modal-title').textContent = '编辑供应商';
    document.getElementById('supplier-edit-index').value = index;
    document.getElementById('supplier-name').value = supplier.name || '';
    document.getElementById('supplier-contact').value = supplier.contact || '';
    document.getElementById('supplier-phone').value = supplier.phone || '';
    document.getElementById('supplier-product').value = supplier.product || '';
    document.getElementById('supplier-coop-type').value = supplier.coopType || '长期合作';
    document.getElementById('supplier-address').value = supplier.address || '';
    document.getElementById('supplier-remark').value = supplier.remark || '';
    document.getElementById('supplier-edit-modal').classList.add('show');
  };

  // 关闭弹窗
  window.closeSupplierModal = function() {
    document.getElementById('supplier-edit-modal').classList.remove('show');
  };

  // 保存供应商
  window.saveSupplierFromForm = function() {
    var name = document.getElementById('supplier-name').value.trim();
    if (!name) {
      alert('请输入供应商名称');
      return;
    }

    var index = document.getElementById('supplier-edit-index').value;
    var supplier = {
      name: name,
      contact: document.getElementById('supplier-contact').value.trim(),
      phone: document.getElementById('supplier-phone').value.trim(),
      product: document.getElementById('supplier-product').value.trim(),
      coopType: document.getElementById('supplier-coop-type').value,
      address: document.getElementById('supplier-address').value.trim(),
      remark: document.getElementById('supplier-remark').value.trim(),
      createTime: new Date().toLocaleString()
    };

    var list = getSupplierList();

    if (index === '') {
      // 新增
      list.push(supplier);
    } else {
      // 编辑
      supplier.createTime = list[index].createTime || supplier.createTime;
      list[index] = supplier;
    }

    saveSupplierList(list);
    closeSupplierModal();
    renderSupplierList();
    showToast(index === '' ? '供应商添加成功' : '供应商更新成功');
  };

  // 删除供应商
  window.deleteSupplier = function(index) {
    if (!confirm('确定要删除该供应商吗？')) return;

    var list = getSupplierList();
    list.splice(index, 1);
    saveSupplierList(list);
    renderSupplierList();
    showToast('供应商已删除');
  };

  // 全选/取消全选
  window.toggleSelectAllSuppliers = function() {
    var checkbox = document.getElementById('select-all-suppliers');
    var checkboxes = document.querySelectorAll('.supplier-checkbox');
    checkboxes.forEach(function(cb) {
      cb.checked = checkbox.checked;
    });
  };

  // 批量删除
  window.batchDeleteSuppliers = function() {
    var checkboxes = document.querySelectorAll('.supplier-checkbox:checked');
    if (checkboxes.length === 0) {
      alert('请先选择要删除的供应商');
      return;
    }

    if (!confirm('确定要删除选中的 ' + checkboxes.length + ' 个供应商吗？')) return;

    var list = getSupplierList();
    // 按索引从大到小排序，避免删除时索引变化
    var indices = Array.from(checkboxes).map(function(cb) { return parseInt(cb.value); });
    indices.sort(function(a, b) { return b - a; });

    indices.forEach(function(idx) {
      list.splice(idx, 1);
    });

    saveSupplierList(list);
    renderSupplierList();
    showToast('已删除 ' + indices.length + ' 个供应商');
  };

  // 搜索过滤
  window.filterSuppliers = function() {
    var keyword = document.getElementById('supplier-search').value.trim().toLowerCase();
    var rows = document.querySelectorAll('#suppliers-tbody tr');

    rows.forEach(function(row) {
      var text = row.textContent.toLowerCase();
      row.style.display = keyword === '' || text.indexOf(keyword) !== -1 ? '' : 'none';
    });
  };

  // 提示消息
  function showToast(message) {
    var toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;top:20px;right:20px;background:#27ae60;color:#fff;padding:12px 20px;border-radius:8px;z-index:9999;font-size:14px;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(function() { toast.remove(); }, 300);
    }, 2000);
  }

  // 点击弹窗外部关闭
  document.addEventListener('click', function(e) {
    var modal = document.getElementById('supplier-edit-modal');
    if (e.target === modal) {
      closeSupplierModal();
    }
  });

  // ESC键关闭弹窗
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeSupplierModal();
    }
  });

  // 页面加载完成后初始化
  document.addEventListener('DOMContentLoaded', function() {
    renderSupplierList();
  });

})();
