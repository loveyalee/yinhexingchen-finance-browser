/**
 * 送货单管理页面 JavaScript
 */

var deliveryNoteStorageKey = 'deliveryNotes';
var deliveryNotesCache = null;
var deliveryNotesLoaded = false;

// ==================== 检查登录状态 ====================
function checkLoginStatus() {
  try {
    var userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    if (!userInfo.isLoggedIn || !userInfo.id) {
      console.log('用户未登录，跳转到登录页面');
      alert('请先登录');
      window.location.href = 'login.html';
      return false;
    }
    return true;
  } catch (e) {
    console.error('检查登录状态失败:', e);
    window.location.href = 'login.html';
    return false;
  }
}

// ==================== API调用辅助函数 ====================
function getCurrentUserId() {
  try {
    var userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
    console.log('当前用户信息:', userInfo);
    console.log('用户ID:', userInfo.id);
    return userInfo.id || '';
  } catch (e) {
    console.error('获取用户ID失败:', e);
    return '';
  }
}

async function apiGetDeliveryNotes() {
  try {
    var userId = getCurrentUserId();
    console.log('请求送货单API，用户ID:', userId);
    var response = await fetch('/api/delivery-notes?userId=' + encodeURIComponent(userId));
    var data = await response.json();
    console.log('API响应:', data);
    if (data.success) {
      return data.data;
    }
    return [];
  } catch (e) {
    console.error('获取送货单列表失败:', e);
    return [];
  }
}

async function apiAddDeliveryNote(note) {
  try {
    var userId = getCurrentUserId();
    var response = await fetch('/api/delivery-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...note, userId: userId })
    });
    var data = await response.json();
    return data;
  } catch (e) {
    console.error('添加送货单失败:', e);
    return { success: false, message: '添加送货单失败' };
  }
}

async function apiUpdateDeliveryNote(note) {
  try {
    var response = await fetch('/api/delivery-notes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(note)
    });
    var data = await response.json();
    return data;
  } catch (e) {
    console.error('更新送货单失败:', e);
    return { success: false, message: '更新送货单失败' };
  }
}

async function apiDeleteDeliveryNote(id) {
  try {
    var response = await fetch('/api/delivery-notes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: id })
    });
    var data = await response.json();
    return data;
  } catch (e) {
    console.error('删除送货单失败:', e);
    return { success: false, message: '删除送货单失败' };
  }
}

// ==================== 送货单管理功能 ====================
async function getAllDeliveryNotesAsync() {
  try {
    console.log('从API获取送货单数据...');
    var apiNotes = await apiGetDeliveryNotes();
    deliveryNotesCache = apiNotes || [];
    deliveryNotesLoaded = true;
    console.log('API返回送货单数量:', deliveryNotesCache.length);
    return deliveryNotesCache;
  } catch (e) {
    console.error('API获取送货单失败:', e);
    deliveryNotesCache = [];
    deliveryNotesLoaded = true;
    return [];
  }
}

function getAllDeliveryNotes() {
  if (deliveryNotesLoaded && deliveryNotesCache) {
    return deliveryNotesCache;
  }
  if (!deliveryNotesLoaded) {
    getAllDeliveryNotesAsync().then(() => {
      renderDeliveryNotesTable();
    });
  }
  return deliveryNotesCache || [];
}

function saveDeliveryNotes(notes) {
  deliveryNotesCache = notes;
  deliveryNotesLoaded = true;
  var userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  var isLoggedIn = userInfo.isLoggedIn || userInfo.id;
  if (!isLoggedIn) {
    localStorage.setItem(deliveryNoteStorageKey, JSON.stringify(notes));
  }
}

// 渲染送货单表格
function renderDeliveryNotesTable() {
  var tbody = document.getElementById('delivery-notes-tbody');
  if (!tbody) return;

  var notes = getAllDeliveryNotes();
  console.log('渲染送货单表格，数据数量:', notes.length);

  if (notes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="17" class="empty-text">暂无送货单数据，请点击"新增送货单"添加</td></tr>';
    return;
  }

  var html = '';
  notes.forEach(function(note, noteIndex) {
    var statusClass = note.status === '已送达' ? 'status-delivered' : 'status-pending';
    var items = note.items || [];

    if (items.length === 0) {
      // 没有商品明细的送货单
      html += '<tr>' +
        '<td><input type="checkbox" class="delivery-note-checkbox" data-index="' + noteIndex + '" data-id="' + (note.id || '') + '"></td>' +
        '<td class="delivery-note-no" onclick="openEditDeliveryNoteModal(' + noteIndex + ')">' + (note.no || '') + '</td>' +
        '<td>' + (note.customer || '') + '</td>' +
        '<td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>' +
        '<td>' + (note.date || '') + '</td>' +
        '<td>' + (note.contact || '') + '</td>' +
        '<td><span class="status-badge ' + statusClass + '" onclick="toggleDeliveryStatus(' + noteIndex + ')">' + (note.status || '待送达') + '</span></td>' +
        '<td>' +
          '<button class="btn btn-sm btn-primary" onclick="openEditDeliveryNoteModal(' + noteIndex + ')">编辑</button> ' +
          '<button class="btn btn-sm btn-warning" onclick="printDeliveryNote(' + noteIndex + ')">打印</button> ' +
          '<button class="btn btn-sm btn-copy" onclick="copyDeliveryNote(' + noteIndex + ')">复制</button> ' +
          '<button class="btn btn-sm btn-danger" onclick="deleteDeliveryNoteRow(' + noteIndex + ')">删除</button>' +
        '</td>' +
      '</tr>';
    } else {
      // 有商品明细，每个商品一行
      items.forEach(function(item, itemIndex) {
        var subtotal = (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 0);
        var rowSpan = itemIndex === 0 ? ' rowspan="' + items.length + '"' : '';

        html += '<tr>';

        // 只在第一行显示送货单信息
        if (itemIndex === 0) {
          html += '<td' + rowSpan + '><input type="checkbox" class="delivery-note-checkbox" data-index="' + noteIndex + '" data-id="' + (note.id || '') + '"></td>';
          html += '<td' + rowSpan + ' class="delivery-note-no" onclick="openEditDeliveryNoteModal(' + noteIndex + ')">' + (note.no || '') + '</td>';
          html += '<td' + rowSpan + '>' + (note.customer || '') + '</td>';
        }

        // 商品明细列
        html += '<td>' + (item.product || item.name || '') + '</td>';
        html += '<td>' + (item.model || '') + '</td>';
        html += '<td>' + (item.length || '') + '</td>';
        html += '<td>' + (item.wattage || '') + '</td>';
        html += '<td>' + (item.brightness || '') + '</td>';
        html += '<td>' + (item.sensorMode || '') + '</td>';
        html += '<td>' + (item.quantity || 0) + '</td>';
        html += '<td>' + (item.unit || '') + '</td>';
        html += '<td>' + (item.price ? '¥' + parseFloat(item.price).toFixed(2) : '') + '</td>';
        html += '<td>' + (subtotal > 0 ? '¥' + subtotal.toFixed(2) : '') + '</td>';

        // 只在第一行显示送货日期、联系人、状态、操作
        if (itemIndex === 0) {
          html += '<td' + rowSpan + '>' + (note.date || '') + '</td>';
          html += '<td' + rowSpan + '>' + (note.contact || '') + '</td>';
          html += '<td' + rowSpan + '><span class="status-badge ' + statusClass + '" onclick="toggleDeliveryStatus(' + noteIndex + ')">' + (note.status || '待送达') + '</span></td>';
          html += '<td' + rowSpan + '>' +
            '<button class="btn btn-sm btn-primary" onclick="openEditDeliveryNoteModal(' + noteIndex + ')">编辑</button> ' +
            '<button class="btn btn-sm btn-warning" onclick="printDeliveryNote(' + noteIndex + ')">打印</button> ' +
            '<button class="btn btn-sm btn-copy" onclick="copyDeliveryNote(' + noteIndex + ')">复制</button> ' +
            '<button class="btn btn-sm btn-danger" onclick="deleteDeliveryNoteRow(' + noteIndex + ')">删除</button>' +
          '</td>';
        }

        html += '</tr>';
      });
    }
  });

  tbody.innerHTML = html;
}

// 计算送货单金额
function calcNoteTotal(items) {
  if (!items || items.length === 0) return 0;
  return items.reduce(function(sum, item) {
    return sum + (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 0);
  }, 0);
}

// 生成送货单号
function generateDeliveryNoteNo() {
  var now = new Date();
  var y = now.getFullYear();
  var m = String(now.getMonth() + 1).padStart(2, '0');
  var d = String(now.getDate()).padStart(2, '0');
  var suffix = String(Date.now()).slice(-3);
  return 'SHD' + y + m + d + suffix;
}

// 打开新增送货单弹窗
window.openAddDeliveryNoteModal = function() {
  document.getElementById('delivery-note-modal-title').textContent = '新增送货单';
  document.getElementById('delivery-note-edit-id').value = '';
  document.getElementById('delivery-customer').value = '';
  document.getElementById('delivery-contact').value = '';
  document.getElementById('delivery-phone').value = '';
  document.getElementById('delivery-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('delivery-address').value = '';
  document.getElementById('delivery-remark').value = '';
  document.getElementById('delivery-items-tbody').innerHTML = '';
  document.getElementById('delivery-total-amount').textContent = '¥0.00';
  addDeliveryItemRow();
  document.getElementById('delivery-note-modal').classList.add('show');
  document.getElementById('delivery-customer').focus();
};

// 打开编辑送货单弹窗
window.openEditDeliveryNoteModal = function(index) {
  var notes = getAllDeliveryNotes();
  var note = notes[index];
  if (!note) return;

  document.getElementById('delivery-note-modal-title').textContent = '编辑送货单';
  document.getElementById('delivery-note-edit-id').value = note.id || '';
  document.getElementById('delivery-customer').value = note.customer || '';
  document.getElementById('delivery-contact').value = note.contact || '';
  document.getElementById('delivery-phone').value = note.contactPhone || '';
  document.getElementById('delivery-date').value = note.date || '';
  document.getElementById('delivery-address').value = note.address || '';
  document.getElementById('delivery-remark').value = note.remark || '';

  var tbody = document.getElementById('delivery-items-tbody');
  tbody.innerHTML = '';

  if (note.items && note.items.length > 0) {
    note.items.forEach(function(item) {
      addDeliveryItemRow(item);
    });
  } else {
    addDeliveryItemRow();
  }

  updateDeliveryTotal();
  document.getElementById('delivery-note-modal').classList.add('show');
};

// 关闭送货单弹窗
window.closeDeliveryNoteModal = function() {
  document.getElementById('delivery-note-modal').classList.remove('show');
};

// 添加商品行
window.addDeliveryItemRow = function(item) {
  var tbody = document.getElementById('delivery-items-tbody');
  if (!tbody) return;

  var rows = tbody.querySelectorAll('tr');
  var rowIndex = rows.length + 1;

  var tr = document.createElement('tr');

  // 行号
  var rowNumTd = document.createElement('td');
  rowNumTd.className = 'row-num';
  rowNumTd.textContent = rowIndex;
  tr.appendChild(rowNumTd);

  // 商品名称
  var nameTd = document.createElement('td');
  var nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'item-name';
  nameInput.placeholder = '商品名称';
  nameInput.value = item ? (item.product || item.name || '') : '';
  nameTd.appendChild(nameInput);
  tr.appendChild(nameTd);

  // 型号
  var modelTd = document.createElement('td');
  var modelInput = document.createElement('input');
  modelInput.type = 'text';
  modelInput.className = 'item-model';
  modelInput.placeholder = '型号';
  modelInput.value = item ? (item.model || '') : '';
  modelTd.appendChild(modelInput);
  tr.appendChild(modelTd);

  // 长度
  var lengthTd = document.createElement('td');
  var lengthInput = document.createElement('input');
  lengthInput.type = 'text';
  lengthInput.className = 'item-length';
  lengthInput.placeholder = '长度';
  lengthInput.value = item ? (item.length || '') : '';
  lengthTd.appendChild(lengthInput);
  tr.appendChild(lengthTd);

  // 瓦数
  var wattageTd = document.createElement('td');
  var wattageInput = document.createElement('input');
  wattageInput.type = 'text';
  wattageInput.className = 'item-wattage';
  wattageInput.placeholder = '瓦数';
  wattageInput.value = item ? (item.wattage || '') : '';
  wattageTd.appendChild(wattageInput);
  tr.appendChild(wattageTd);

  // 单/双亮
  var brightnessTd = document.createElement('td');
  var brightnessSelect = document.createElement('select');
  brightnessSelect.className = 'item-brightness';
  brightnessSelect.innerHTML = '<option value="">选择</option><option value="单亮">单亮</option><option value="双亮">双亮</option>';
  brightnessSelect.value = item ? (item.brightness || '') : '';
  brightnessTd.appendChild(brightnessSelect);
  tr.appendChild(brightnessTd);

  // 感应模式
  var sensorTd = document.createElement('td');
  var sensorSelect = document.createElement('select');
  sensorSelect.className = 'item-sensor';
  sensorSelect.innerHTML = '<option value="">选择</option><option value="微波感应">微波感应</option><option value="红外感应">红外感应</option><option value="雷达感应">雷达感应</option><option value="无感应">无感应</option>';
  sensorSelect.value = item ? (item.sensorMode || item.sensor || '') : '';
  sensorTd.appendChild(sensorSelect);
  tr.appendChild(sensorTd);

  // 数量
  var qtyTd = document.createElement('td');
  var qtyInput = document.createElement('input');
  qtyInput.type = 'number';
  qtyInput.className = 'item-quantity';
  qtyInput.placeholder = '数量';
  qtyInput.min = '1';
  qtyInput.value = item ? (item.quantity || 1) : 1;
  qtyInput.addEventListener('input', function() {
    updateRowSubtotal(tr);
    updateDeliveryTotal();
  });
  qtyTd.appendChild(qtyInput);
  tr.appendChild(qtyTd);

  // 单位
  var unitTd = document.createElement('td');
  var unitSelect = document.createElement('select');
  unitSelect.className = 'item-unit';
  unitSelect.innerHTML = '<option value="个">个</option><option value="件">件</option><option value="套">套</option><option value="米">米</option><option value="根">根</option><option value="台">台</option><option value="箱">箱</option>';
  unitSelect.value = item ? (item.unit || '个') : '个';
  unitTd.appendChild(unitSelect);
  tr.appendChild(unitTd);

  // 单价
  var priceTd = document.createElement('td');
  var priceInput = document.createElement('input');
  priceInput.type = 'number';
  priceInput.className = 'item-price';
  priceInput.placeholder = '单价';
  priceInput.step = '0.01';
  priceInput.min = '0';
  priceInput.value = item ? (item.price || '') : '';
  priceInput.addEventListener('input', function() {
    updateRowSubtotal(tr);
    updateDeliveryTotal();
  });
  priceTd.appendChild(priceInput);
  tr.appendChild(priceTd);

  // 小计
  var subtotalTd = document.createElement('td');
  subtotalTd.className = 'item-subtotal';
  subtotalTd.textContent = '¥0.00';
  tr.appendChild(subtotalTd);

  // 删除按钮
  var actionTd = document.createElement('td');
  var removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'btn-remove-row';
  removeButton.textContent = '✕';
  removeButton.onclick = function() {
    tr.remove();
    updateRowNumbers();
    updateDeliveryTotal();
  };
  actionTd.appendChild(removeButton);
  tr.appendChild(actionTd);

  tbody.appendChild(tr);
  updateRowSubtotal(tr);
  updateDeliveryTotal();
};

// 更新行小计
function updateRowSubtotal(tr) {
  var qty = parseFloat(tr.querySelector('.item-quantity').value) || 0;
  var price = parseFloat(tr.querySelector('.item-price').value) || 0;
  var subtotal = qty * price;
  tr.querySelector('.item-subtotal').textContent = '¥' + subtotal.toFixed(2);
}

// 更新行号
function updateRowNumbers() {
  var tbody = document.getElementById('delivery-items-tbody');
  var rows = tbody.querySelectorAll('tr');
  rows.forEach(function(row, index) {
    row.querySelector('.row-num').textContent = index + 1;
  });
}

// 更新合计金额
function updateDeliveryTotal() {
  var tbody = document.getElementById('delivery-items-tbody');
  var rows = tbody.querySelectorAll('tr');
  var total = 0;
  rows.forEach(function(row) {
    var qty = parseFloat(row.querySelector('.item-quantity').value) || 0;
    var price = parseFloat(row.querySelector('.item-price').value) || 0;
    total += qty * price;
  });
  document.getElementById('delivery-total-amount').textContent = '¥' + total.toFixed(2);
}

// 保存送货单
window.saveDeliveryNote = async function() {
  var editId = document.getElementById('delivery-note-edit-id').value;
  var customer = document.getElementById('delivery-customer').value.trim();
  var contact = document.getElementById('delivery-contact').value.trim();
  var phone = document.getElementById('delivery-phone').value.trim();
  var date = document.getElementById('delivery-date').value;
  var address = document.getElementById('delivery-address').value.trim();
  var remark = document.getElementById('delivery-remark').value.trim();

  if (!customer) {
    alert('请输入客户名称');
    return;
  }
  if (!date) {
    alert('请选择送货日期');
    return;
  }

  // 收集商品明细
  var tbody = document.getElementById('delivery-items-tbody');
  var rows = tbody.querySelectorAll('tr');
  var items = [];
  rows.forEach(function(row) {
    var name = row.querySelector('.item-name').value.trim();
    var model = row.querySelector('.item-model').value.trim();
    var length = row.querySelector('.item-length').value.trim();
    var wattage = row.querySelector('.item-wattage').value.trim();
    var brightness = row.querySelector('.item-brightness').value;
    var sensorMode = row.querySelector('.item-sensor').value;
    var qty = parseFloat(row.querySelector('.item-quantity').value) || 0;
    var unit = row.querySelector('.item-unit').value;
    var price = parseFloat(row.querySelector('.item-price').value) || 0;
    if (name && qty > 0) {
      items.push({
        product: name,
        name: name,
        model: model,
        length: length,
        wattage: wattage,
        brightness: brightness,
        sensorMode: sensorMode,
        quantity: qty,
        unit: unit,
        price: price
      });
    }
  });

  var noteData = {
    no: generateDeliveryNoteNo(),
    customer: customer,
    contact: contact,
    contactPhone: phone,
    date: date,
    address: address,
    remark: remark,
    items: items,
    status: '待送达'
  };

  var userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  var isLoggedIn = userInfo.isLoggedIn || userInfo.id;

  if (isLoggedIn) {
    try {
      var result;
      if (editId) {
        noteData.id = editId;
        result = await apiUpdateDeliveryNote(noteData);
      } else {
        result = await apiAddDeliveryNote(noteData);
      }
      if (result.success) {
        deliveryNotesLoaded = false;
        await getAllDeliveryNotesAsync();
        renderDeliveryNotesTable();
        closeDeliveryNoteModal();
        alert(editId ? '送货单修改成功' : '送货单添加成功');
      } else {
        alert(result.message || '保存失败');
      }
    } catch (e) {
      console.error('保存送货单失败:', e);
      alert('保存失败，请重试');
    }
  } else {
    var notes = getAllDeliveryNotes();
    notes.push(noteData);
    saveDeliveryNotes(notes);
    renderDeliveryNotesTable();
    closeDeliveryNoteModal();
    alert('送货单添加成功');
  }
};

// 保存并新增
window.saveAndNewDeliveryNote = async function() {
  await saveDeliveryNote();
  if (document.getElementById('delivery-note-modal').classList.contains('show')) {
    // 如果弹窗还开着说明保存失败了
    return;
  }
  openAddDeliveryNoteModal();
};

// 删除送货单行
window.deleteDeliveryNoteRow = async function(index) {
  var notes = getAllDeliveryNotes();
  var note = notes[index];
  if (!note) return;

  if (!confirm('确定要删除送货单"' + (note.no || '') + '"吗？')) return;

  var userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  var isLoggedIn = userInfo.isLoggedIn || userInfo.id;

  if (isLoggedIn && note.id) {
    try {
      var result = await apiDeleteDeliveryNote(note.id);
      if (result.success) {
        deliveryNotesLoaded = false;
        await getAllDeliveryNotesAsync();
        renderDeliveryNotesTable();
        alert('送货单已删除');
      } else {
        alert(result.message || '删除失败');
      }
    } catch (e) {
      console.error('删除送货单失败:', e);
      alert('删除失败，请重试');
    }
  } else {
    notes.splice(index, 1);
    saveDeliveryNotes(notes);
    renderDeliveryNotesTable();
    alert('送货单已删除');
  }
};

// 切换送货单状态
window.toggleDeliveryStatus = async function(index) {
  var notes = getAllDeliveryNotes();
  var note = notes[index];
  if (!note) return;

  note.status = note.status === '已送达' ? '待送达' : '已送达';

  var userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  var isLoggedIn = userInfo.isLoggedIn || userInfo.id;

  if (isLoggedIn && note.id) {
    try {
      var result = await apiUpdateDeliveryNote(note);
      if (result.success) {
        renderDeliveryNotesTable();
      }
    } catch (e) {
      console.error('更新状态失败:', e);
    }
  } else {
    saveDeliveryNotes(notes);
    renderDeliveryNotesTable();
  }
};

// 复制送货单
window.copyDeliveryNote = async function(index) {
  var notes = getAllDeliveryNotes();
  var note = notes[index];
  if (!note) return;

  // 创建新的送货单副本
  var newNote = {
    no: generateDeliveryNoteNo(),
    customer: note.customer,
    contact: note.contact,
    contactPhone: note.contactPhone,
    date: new Date().toISOString().split('T')[0],
    address: note.address,
    remark: note.remark,
    items: note.items ? JSON.parse(JSON.stringify(note.items)) : [],
    status: '待送达'
  };

  var userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  var isLoggedIn = userInfo.isLoggedIn || userInfo.id;

  if (isLoggedIn) {
    try {
      var result = await apiAddDeliveryNote(newNote);
      if (result.success) {
        deliveryNotesLoaded = false;
        await getAllDeliveryNotesAsync();
        renderDeliveryNotesTable();
        alert('送货单复制成功');
      } else {
        alert(result.message || '复制失败');
      }
    } catch (e) {
      console.error('复制送货单失败:', e);
      alert('复制失败，请重试');
    }
  } else {
    notes.push(newNote);
    saveDeliveryNotes(notes);
    renderDeliveryNotesTable();
    alert('送货单复制成功');
  }
};

// 全选/取消全选
window.toggleSelectAllDeliveryNotes = function() {
  var selectAllCheckbox = document.getElementById('select-all-delivery-notes');
  var checkboxes = document.querySelectorAll('.delivery-note-checkbox');
  var allChecked = true;
  checkboxes.forEach(function(checkbox) {
    if (!checkbox.checked) allChecked = false;
  });
  var newChecked = !allChecked;
  selectAllCheckbox.checked = newChecked;
  checkboxes.forEach(function(checkbox) {
    checkbox.checked = newChecked;
  });
};

// 批量删除送货单
window.batchDeleteDeliveryNotes = async function() {
  var checkboxes = document.querySelectorAll('.delivery-note-checkbox:checked');
  if (checkboxes.length === 0) {
    alert('请先选择要删除的送货单');
    return;
  }

  if (!confirm('确定要删除选中的 ' + checkboxes.length + ' 条送货单吗？')) return;

  var userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
  var isLoggedIn = userInfo.isLoggedIn || userInfo.id;

  if (isLoggedIn) {
    var deletePromises = [];
    checkboxes.forEach(function(checkbox) {
      var noteId = checkbox.getAttribute('data-id');
      if (noteId) {
        deletePromises.push(apiDeleteDeliveryNote(noteId));
      }
    });

    if (deletePromises.length === 0) {
      alert('没有找到有效的送货单ID，请刷新页面重试');
      return;
    }

    try {
      await Promise.all(deletePromises);
      deliveryNotesLoaded = false;
      await getAllDeliveryNotesAsync();
      renderDeliveryNotesTable();
      alert('已删除 ' + deletePromises.length + ' 条送货单');
    } catch (e) {
      console.error('批量删除失败:', e);
      alert('删除失败，请重试');
    }
  } else {
    var notes = getAllDeliveryNotes();
    var indicesToDelete = [];
    checkboxes.forEach(function(checkbox) {
      indicesToDelete.push(parseInt(checkbox.getAttribute('data-index')));
    });
    indicesToDelete.sort(function(a, b) { return b - a; });
    indicesToDelete.forEach(function(index) {
      notes.splice(index, 1);
    });
    saveDeliveryNotes(notes);
    renderDeliveryNotesTable();
    alert('已删除 ' + checkboxes.length + ' 条送货单');
  }
};

// 导出单个送货单为Word
window.exportSingleDeliveryNote = function(index) {
  var notes = getAllDeliveryNotes();
  var note = notes[index];
  if (!note) {
    alert('送货单不存在');
    return;
  }

  var totalAmount = calcNoteTotal(note.items);

  var docContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>送货单 - ${note.no || ''}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    body { font-family: 'Microsoft YaHei', Arial, sans-serif; margin: 0; line-height: 1.5; font-size: 12px; }
    .header { text-align: center; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #333; }
    .header h1 { font-size: 18px; color: #333; margin: 0; }
    .info-section { display: flex; justify-content: space-between; margin-bottom: 12px; }
    .info-section .info { font-size: 11px; }
    .info-section .info p { margin: 2px 0; }
    .items-table { width: 100%; border-collapse: collapse; margin: 10px 0; table-layout: fixed; }
    .items-table th, .items-table td { border: 1px solid #333; padding: 3px 2px; text-align: center; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .items-table th { background-color: #f5f5f5; font-weight: 600; }
    .items-table .col-no { width: 22px; }
    .items-table .col-name { width: 70px; }
    .items-table .col-model { width: 40px; }
    .items-table .col-length { width: 30px; }
    .items-table .col-wattage { width: 30px; }
    .items-table .col-brightness { width: 40px; }
    .items-table .col-sensor { width: 50px; }
    .items-table .col-qty { width: 25px; }
    .items-table .col-unit { width: 25px; }
    .items-table .col-price { width: 45px; }
    .items-table .col-subtotal { width: 50px; }
    .total-section { text-align: right; margin-top: 8px; font-size: 13px; font-weight: 600; }
    .total-section .amount { color: #e74c3c; }
    .remark-section { margin-top: 8px; font-size: 10px; }
    .footer { margin-top: 25px; display: flex; justify-content: space-between; }
    .signature-box { width: 100px; text-align: center; font-size: 10px; }
    .signature-box .line { border-top: 1px solid #333; margin-top: 25px; padding-top: 2px; }
  </style>
</head>
<body>
  <div class="header"><h1>送 货 单</h1></div>
  <div class="info-section">
    <div class="info">
      <p><strong>送货单号：</strong>${note.no || ''}</p>
      <p><strong>客户名称：</strong>${note.customer || ''}</p>
      <p><strong>联系人：</strong>${note.contact || '-'}</p>
      ${note.contactPhone ? '<p><strong>联系电话：</strong>' + note.contactPhone + '</p>' : ''}
    </div>
    <div class="info">
      <p><strong>送货日期：</strong>${note.date || ''}</p>
      <p><strong>送货地址：</strong>${note.address || '-'}</p>
      <p><strong>状态：</strong>${note.status || '待送达'}</p>
    </div>
  </div>
  <table class="items-table">
    <thead>
      <tr>
        <th class="col-no">序号</th>
        <th class="col-name">商品名称</th>
        <th class="col-model">型号</th>
        <th class="col-length">长度</th>
        <th class="col-wattage">瓦数</th>
        <th class="col-brightness">单/双亮</th>
        <th class="col-sensor">感应模式</th>
        <th class="col-qty">数量</th>
        <th class="col-unit">单位</th>
        <th class="col-price">单价</th>
        <th class="col-subtotal">小计</th>
      </tr>
    </thead>
    <tbody>
      ${(note.items || []).map(function(item, i) {
        var subtotal = (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 0);
        return '<tr><td>' + (i + 1) + '</td><td>' + (item.product || item.name || '') + '</td><td>' + (item.model || '') + '</td><td>' + (item.length || '') + '</td><td>' + (item.wattage || '') + '</td><td>' + (item.brightness || '') + '</td><td>' + (item.sensorMode || item.sensor || '') + '</td><td>' + (item.quantity || 0) + '</td><td>' + (item.unit || '个') + '</td><td>¥' + (parseFloat(item.price) || 0).toFixed(2) + '</td><td>¥' + subtotal.toFixed(2) + '</td></tr>';
      }).join('')}
    </tbody>
  </table>
  <div class="total-section">合计金额：<span class="amount">¥${totalAmount.toFixed(2)}</span></div>
  ${note.remark ? '<div class="remark-section"><strong>备注：</strong>' + note.remark + '</div>' : ''}
  <div class="footer">
    <div class="signature-box"><div class="line">收货人签字</div></div>
    <div class="signature-box"><div class="line">送货人签字</div></div>
  </div>
</body>
</html>
  `;

  var blob = new Blob([docContent], { type: 'application/msword' });
  var link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = '送货单_' + (note.no || 'export') + '.doc';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// 打印送货单
window.printDeliveryNote = function(index) {
  var notes = getAllDeliveryNotes();
  var note = notes[index];
  if (!note) {
    alert('送货单不存在');
    return;
  }

  var totalAmount = calcNoteTotal(note.items);

  var printContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>送货单 - ${note.no || ''}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm;
    }
    @media print {
      body { margin: 0; }
      .no-print { display: none !important; }
      @page { size: A4 portrait; margin: 10mm; }
    }
    body { font-family: 'Microsoft YaHei', Arial, sans-serif; margin: 0; line-height: 1.5; font-size: 12px; }
    .header { text-align: center; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #333; }
    .header h1 { font-size: 18px; color: #333; margin: 0; }
    .info-section { display: flex; justify-content: space-between; margin-bottom: 12px; }
    .info-section .info { font-size: 11px; }
    .info-section .info p { margin: 2px 0; }
    .items-table { width: 100%; border-collapse: collapse; margin: 10px 0; table-layout: fixed; }
    .items-table th, .items-table td { border: 1px solid #333; padding: 3px 2px; text-align: center; font-size: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .items-table th { background-color: #f5f5f5; font-weight: 600; }
    .items-table .col-no { width: 22px; }
    .items-table .col-name { width: 70px; }
    .items-table .col-model { width: 40px; }
    .items-table .col-length { width: 30px; }
    .items-table .col-wattage { width: 30px; }
    .items-table .col-brightness { width: 40px; }
    .items-table .col-sensor { width: 50px; }
    .items-table .col-qty { width: 25px; }
    .items-table .col-unit { width: 25px; }
    .items-table .col-price { width: 45px; }
    .items-table .col-subtotal { width: 50px; }
    .total-section { text-align: right; margin-top: 8px; font-size: 13px; font-weight: 600; }
    .total-section .amount { color: #e74c3c; }
    .remark-section { margin-top: 8px; font-size: 10px; }
    .footer { margin-top: 25px; display: flex; justify-content: space-between; }
    .signature-box { width: 100px; text-align: center; font-size: 10px; }
    .signature-box .line { border-top: 1px solid #333; margin-top: 25px; padding-top: 2px; }
    .print-btn { position: fixed; top: 15px; right: 15px; padding: 8px 16px; background: #1a65b8; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">打印</button>
  <div class="header"><h1>送 货 单</h1></div>
  <div class="info-section">
    <div class="info">
      <p><strong>送货单号：</strong>${note.no || ''}</p>
      <p><strong>客户名称：</strong>${note.customer || ''}</p>
      <p><strong>联系人：</strong>${note.contact || '-'}</p>
      ${note.contactPhone ? '<p><strong>联系电话：</strong>' + note.contactPhone + '</p>' : ''}
    </div>
    <div class="info">
      <p><strong>送货日期：</strong>${note.date || ''}</p>
      <p><strong>送货地址：</strong>${note.address || '-'}</p>
      <p><strong>状态：</strong>${note.status || '待送达'}</p>
    </div>
  </div>
  <table class="items-table">
    <thead>
      <tr>
        <th class="col-no">序号</th>
        <th class="col-name">商品名称</th>
        <th class="col-model">型号</th>
        <th class="col-length">长度</th>
        <th class="col-wattage">瓦数</th>
        <th class="col-brightness">单/双亮</th>
        <th class="col-sensor">感应模式</th>
        <th class="col-qty">数量</th>
        <th class="col-unit">单位</th>
        <th class="col-price">单价</th>
        <th class="col-subtotal">小计</th>
      </tr>
    </thead>
    <tbody>
      ${(note.items || []).map(function(item, i) {
        var subtotal = (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 0);
        return '<tr><td>' + (i + 1) + '</td><td>' + (item.product || item.name || '') + '</td><td>' + (item.model || '') + '</td><td>' + (item.length || '') + '</td><td>' + (item.wattage || '') + '</td><td>' + (item.brightness || '') + '</td><td>' + (item.sensorMode || item.sensor || '') + '</td><td>' + (item.quantity || 0) + '</td><td>' + (item.unit || '个') + '</td><td>¥' + (parseFloat(item.price) || 0).toFixed(2) + '</td><td>¥' + subtotal.toFixed(2) + '</td></tr>';
      }).join('')}
    </tbody>
  </table>
  <div class="total-section">合计金额：<span class="amount">¥${totalAmount.toFixed(2)}</span></div>
  ${note.remark ? '<div class="remark-section"><strong>备注：</strong>' + note.remark + '</div>' : ''}
  <div class="footer">
    <div class="signature-box"><div class="line">收货人签字</div></div>
    <div class="signature-box"><div class="line">送货人签字</div></div>
  </div>
</body>
</html>
  `;
      <p><strong>客户名称：</strong>${note.customer || ''}</p>
      <p><strong>联系人：</strong>${note.contact || '-'}</p>
      ${note.contactPhone ? '<p><strong>联系电话：</strong>' + note.contactPhone + '</p>' : ''}
    </div>
    <div class="info">
      <p><strong>送货日期：</strong>${note.date || ''}</p>
      <p><strong>送货地址：</strong>${note.address || '-'}</p>
      <p><strong>状态：</strong>${note.status || '待送达'}</p>
    </div>
  </div>
  <table class="items-table">
    <thead>
      <tr>
        <th class="col-no">序号</th>
        <th class="col-name">商品名称</th>
        <th class="col-model">型号</th>
        <th class="col-length">长度</th>
        <th class="col-wattage">瓦数</th>
        <th class="col-brightness">单/双亮</th>
        <th class="col-sensor">感应模式</th>
        <th class="col-qty">数量</th>
        <th class="col-unit">单位</th>
        <th class="col-price">单价</th>
        <th class="col-subtotal">小计</th>
      </tr>
    </thead>
    <tbody>
      ${(note.items || []).map(function(item, i) {
        var subtotal = (parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 0);
        return '<tr><td>' + (i + 1) + '</td><td>' + (item.product || item.name || '') + '</td><td>' + (item.model || '') + '</td><td>' + (item.length || '') + '</td><td>' + (item.wattage || '') + '</td><td>' + (item.brightness || '') + '</td><td>' + (item.sensorMode || item.sensor || '') + '</td><td>' + (item.quantity || 0) + '</td><td>' + (item.unit || '个') + '</td><td>¥' + (parseFloat(item.price) || 0).toFixed(2) + '</td><td>¥' + subtotal.toFixed(2) + '</td></tr>';
      }).join('')}
    </tbody>
  </table>
  <div class="total-section">合计金额：<span class="amount">¥${totalAmount.toFixed(2)}</span></div>
  ${note.remark ? '<div class="remark-section"><strong>备注：</strong>' + note.remark + '</div>' : ''}
  <div class="footer">
    <div class="signature-box"><div class="line">收货人签字</div></div>
    <div class="signature-box"><div class="line">送货人签字</div></div>
  </div>
</body>
</html>
  `;

  var printWindow = window.open('', '_blank');
  printWindow.document.write(printContent);
  printWindow.document.close();
};

// 页面初始化
document.addEventListener('DOMContentLoaded', async function() {
  try {
    // 检查登录状态
    if (!checkLoginStatus()) {
      return;
    }
    await getAllDeliveryNotesAsync();
    renderDeliveryNotesTable();
  } catch (e) {
    console.error('初始化失败:', e);
  }
});
