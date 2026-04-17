(function () {
  function openPage(page, params) {
    var query = '';
    if (params && typeof URLSearchParams !== 'undefined') {
      query = '?' + new URLSearchParams(params).toString();
    }
    window.location.href = page + query;
  }

  if (typeof window.toggleSubmenu !== 'function') {
    window.toggleSubmenu = function (element) {
      var navItem = element && element.closest ? element.closest('.has-submenu') : null;
      if (navItem) navItem.classList.toggle('active');
    };
  }

  if (typeof window.toggleMemberSubmenu !== 'function') {
    window.toggleMemberSubmenu = function (element) {
      var navItem = element && element.closest ? element.closest('.nav-item.has-submenu') : null;
      if (navItem) navItem.classList.toggle('active');
    };
  }

  if (typeof window.handleLogout !== 'function') {
    window.handleLogout = function () {
      if (confirm('确定要退出登录吗？')) {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userProfile');
        localStorage.removeItem('userWallet');
        localStorage.removeItem('userTransactions');
        window.location.href = 'login.html';
      }
    };
  }

  if (typeof window.showModule !== 'function') {
    window.showModule = function (module) {
      var moduleMap = {
        'contract-management': 'contract_management.html',
        'seal-management': 'seal_management.html',
        'inventory-management': 'inventory_management.html',
        'company-management': 'member.html',
        'financing-bank': 'enterprise_management.html',
        'financing-equity': 'enterprise_management.html',
        'financing-bond': 'enterprise_management.html',
        'financing-lease': 'enterprise_management.html',
        'financing-government': 'enterprise_management.html',
        'financing-selfservice': 'enterprise_management.html',
        'bidding': 'enterprise_management.html',
        'invoice-management': 'invoice_management.html',
        'tax-plan': 'tax_reporting.html',
        'tax-consult': 'tax_reporting.html',
        'tax-risk': 'tax_reporting.html',
        'tax-equity': 'tax_reporting.html'
      };
      if (moduleMap[module]) {
        window.location.href = moduleMap[module];
      }
    };
  }

  if (typeof window.navigateFinanceCenter !== 'function') {
    window.navigateFinanceCenter = function (center) {
      var map = {
        voucher: { page: 'finance_software.html', params: { from: 'smart_assistant', tab: 'voucher' } },
        ledger: { page: 'finance_software.html', params: { from: 'smart_assistant', tab: 'ledger' } },
        detail: { page: 'accounting_v2.html', params: { from: 'smart_assistant', tab: 'detail' } },
        reports: { page: 'data_analysis.html', params: { from: 'smart_assistant', view: 'reports' } },
        tax: { page: 'tax_reporting.html', params: { from: 'smart_assistant', view: 'tax' } },
        risk: { page: 'risk_management.html', params: { from: 'smart_assistant', view: 'risk' } },
        budget: { page: 'budget_management.html', params: { from: 'smart_assistant', view: 'budget' } },
        invoice: { page: 'invoice_management.html', params: { from: 'smart_assistant', view: 'invoice' } },
        close: { page: 'finance_software.html', params: { from: 'smart_assistant', tab: 'closing' } },
        receivable: { page: 'finance_bp.html', params: { from: 'smart_assistant', view: 'receivable' } },
        cashflow: { page: 'data_analysis.html', params: { from: 'smart_assistant', view: 'cashflow' } }
      };
      if (map[center]) {
        openPage(map[center].page, map[center].params);
      }
    };
  }

  if (typeof window.sendMessage !== 'function') {
    window.sendMessage = function (prefill) {
      var text = typeof prefill === 'string' ? prefill : '';
      var input = document.getElementById('chatInput');
      var messages = document.getElementById('chatMessages');

      if (input) {
        input.value = text;
        input.focus();
      }

      if (!messages || !text) return;

      var now = new Date();
      var time = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

      var userDiv = document.createElement('div');
      userDiv.className = 'message user';
      userDiv.innerHTML = '<div class="message-content"></div><div class="message-time">' + time + '</div>';
      userDiv.querySelector('.message-content').textContent = text;
      messages.appendChild(userDiv);

      var assistantDiv = document.createElement('div');
      assistantDiv.className = 'message assistant';
      assistantDiv.innerHTML = '<div class="message-content">主助手脚本未完整加载，已为你恢复基础跳转和消息输入。你可以继续发送这条指令，或直接使用上方快捷入口。</div><div class="message-time">' + time + '</div>';
      messages.appendChild(assistantDiv);
      messages.scrollTop = messages.scrollHeight;
    };
  }
})();
