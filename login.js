// 自动识别账号类型
function detectAccountType(account) {
  // 手机号：1开头，11位数字
  if (/^1[3-9]\d{9}$/.test(account)) {
    return 'phone';
  }
  // 邮箱：包含@符号
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account)) {
    return 'email';
  }
  // 身份证号：18位，最后一位可以是X
  if (/^\d{17}[\dXx]$/.test(account)) {
    return 'idcard';
  }
  return 'unknown';
}

// 更新账号类型提示
function updateAccountBadge(type) {
  const badge = document.getElementById('login-type-badge');
  badge.className = 'login-type-badge ' + type;

  const typeNames = {
    'phone': '📱 手机号',
    'email': '📧 邮箱',
    'idcard': '🪪 身份证',
    'unknown': ''
  };

  badge.textContent = typeNames[type] || '';
}

// 企业搜索相关变量
var enterpriseSearchTimer = null;
var selectedEnterprise = null;

// 用户类型选择
function selectUserType(el, type) {
  document.querySelectorAll('.user-type-card').forEach(function(card) {
    card.classList.remove('active');
  });
  el.classList.add('active');
  el.querySelector('input[type="radio"]').checked = true;

  // 根据用户类型更新输入提示
  const accountInput = document.getElementById('account');
  const inputHint = document.querySelector('.input-hint');
  const enterpriseNameField = document.getElementById('enterprise-name-field');

  if (type === 'enterprise') {
    accountInput.placeholder = '请输入用户名';
    if (inputHint) inputHint.textContent = '企业用户请使用用户名登录';
    if (enterpriseNameField) enterpriseNameField.style.display = 'none';
  } else {
    accountInput.placeholder = '请输入手机号、邮箱或身份证号';
    if (inputHint) inputHint.textContent = '支持手机号、邮箱和身份证号登录';
    if (enterpriseNameField) enterpriseNameField.style.display = 'none';
  }
}

// 企业名称智能搜索
function initEnterpriseSearch() {
  var enterpriseNameInput = document.getElementById('enterprise-name');
  var suggestionsDiv = document.getElementById('enterprise-suggestions');
  var statusDiv = document.getElementById('enterprise-search-status');

  if (!enterpriseNameInput) return;

  enterpriseNameInput.addEventListener('input', function() {
    var keyword = this.value.trim();

    // 清除之前的定时器
    if (enterpriseSearchTimer) {
      clearTimeout(enterpriseSearchTimer);
    }

    // 重置选中的企业
    selectedEnterprise = null;

    if (keyword.length < 2) {
      suggestionsDiv.style.display = 'none';
      statusDiv.textContent = '';
      return;
    }

    statusDiv.textContent = '正在搜索...';
    statusDiv.style.color = '#388bfd';

    // 延迟搜索，避免频繁请求
    enterpriseSearchTimer = setTimeout(function() {
      searchEnterprise(keyword);
    }, 500);
  });

  // 点击其他地方关闭下拉
  document.addEventListener('click', function(e) {
    if (!enterpriseNameInput.contains(e.target) && !suggestionsDiv.contains(e.target)) {
      suggestionsDiv.style.display = 'none';
    }
  });
}

// 搜索企业
function searchEnterprise(keyword) {
  var suggestionsDiv = document.getElementById('enterprise-suggestions');
  var statusDiv = document.getElementById('enterprise-search-status');

  // 调用后端API搜索企业
  fetch('/api/enterprise/search?keyword=' + encodeURIComponent(keyword))
    .then(function(resp) { return resp.json(); })
    .then(function(result) {
      if (result.success && result.data && result.data.length > 0) {
        statusDiv.textContent = '找到 ' + result.data.length + ' 个相关企业';
        statusDiv.style.color = '#27ae60';
        renderEnterpriseSuggestions(result.data);
      } else {
        statusDiv.textContent = '未找到相关企业，请检查企业名称';
        statusDiv.style.color = '#e74c3c';
        suggestionsDiv.style.display = 'none';
      }
    })
    .catch(function(err) {
      statusDiv.textContent = '搜索失败：' + err.message;
      statusDiv.style.color = '#e74c3c';
      suggestionsDiv.style.display = 'none';
    });
}

// 渲染企业搜索建议
function renderEnterpriseSuggestions(enterprises) {
  var suggestionsDiv = document.getElementById('enterprise-suggestions');
  var html = '';

  enterprises.forEach(function(ent, index) {
    html += '<div class="suggestion-item" onclick="selectEnterprise(' + index + ')">' +
              '<div class="name">' + ent.name + '</div>' +
              '<div class="credit-code">统一社会信用代码：' + ent.creditCode + '</div>' +
              '<div class="legal-person">法定代表人：' + (ent.legalPerson || '-') + '</div>' +
            '</div>';
  });

  suggestionsDiv.innerHTML = html;
  suggestionsDiv.style.display = 'block';

  // 存储企业数据供选择使用
  window.enterpriseSearchResults = enterprises;
}

// 选择企业
function selectEnterprise(index) {
  var enterprise = window.enterpriseSearchResults[index];
  if (!enterprise) return;

  selectedEnterprise = enterprise;

  // 填充表单
  document.getElementById('enterprise-name').value = enterprise.name;
  document.getElementById('account').value = enterprise.creditCode;
  document.getElementById('account').dispatchEvent(new Event('input'));

  // 隐藏下拉
  document.getElementById('enterprise-suggestions').style.display = 'none';

  var statusDiv = document.getElementById('enterprise-search-status');
  statusDiv.textContent = '已选择：' + enterprise.name;
  statusDiv.style.color = '#27ae60';
}

// 输入框实时检测
document.addEventListener('DOMContentLoaded', function() {
  const accountInput = document.getElementById('account');
  const loginForm = document.getElementById('login-form');

  if (accountInput) {
    accountInput.addEventListener('input', function() {
      const type = detectAccountType(this.value.trim());
      updateAccountBadge(type);
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      handleLogin();
    });
  }

  initDesktopUpdaterBanner();
});

// 统一登录处理
function handleLogin() {
  const account = document.getElementById('account').value.trim();
  const password = document.getElementById('password').value;
  const userType = document.querySelector('input[name="user-type"]:checked').value;

  if (!account || !password) {
    alert('请输入账号和密码');
    return;
  }

  const accountType = detectAccountType(account);

  // 企业用户登录验证
  if (userType === 'enterprise') {
    // 企业用户只能使用用户名登录
    if (account.length < 2) {
      alert('请输入有效的用户名');
      return;
    }
  } else {
    // 个人用户：支持手机号、邮箱、身份证号或用户名登录
    if (accountType === 'unknown') {
      if (account.length >= 2) {
        // 允许用户名登录
      } else {
        alert('请输入有效的手机号、邮箱、身份证号或用户名');
        return;
      }
    }
  }

  fetch('/api/users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: account, password: password, userType: userType })
  }).then(function(resp) {
    return resp.json();
  }).then(function(result) {
    if (!result.success) {
      alert(result.message || '登录失败');
      return;
    }

    // 验证用户类型是否匹配
    if (result.data.userType && userType !== result.data.userType) {
      const typeNames = { 'personal': '个人用户', 'enterprise': '企业用户', 'institution': '第三方机构' };
      alert('账号类型不匹配，该账号是' + (typeNames[result.data.userType] || result.data.userType) + '，请选择正确的用户类型');
      return;
    }

    const userInfo = Object.assign({}, result.data, {
      loginMethod: accountType,
      isLoggedIn: true
    });

    localStorage.setItem('userInfo', JSON.stringify(userInfo));
    localStorage.setItem('currentUserId', userInfo.id);
    localStorage.setItem('currentUserDb', userInfo.currentUserDb || userInfo.localDbFile || '');
    window.location.href = 'index.html';
  }).catch(function(err) {
    alert('登录失败：' + err.message);
  });
}

function initDesktopUpdaterBanner() {
  if (!window.electronAPI || !window.electronAPI.updates) {
    return;
  }

  const banner = document.getElementById('update-banner');
  const title = document.getElementById('update-title');
  const message = document.getElementById('update-message');
  const meta = document.getElementById('update-meta');
  const actions = document.getElementById('update-actions');
  const primaryBtn = document.getElementById('update-primary-btn');
  const secondaryBtn = document.getElementById('update-secondary-btn');
  const progressWrap = document.getElementById('update-progress');
  const progressBar = document.getElementById('update-progress-bar');

  if (!banner || !title || !message || !meta || !actions || !primaryBtn || !secondaryBtn || !progressWrap || !progressBar) {
    return;
  }

  function showBanner() {
    banner.classList.add('show');
  }

  function hideBanner() {
    banner.classList.remove('show');
  }

  function hideProgress() {
    progressWrap.classList.remove('show');
    progressBar.style.width = '0%';
  }

  function setState(next) {
    showBanner();
    title.textContent = next.title || '桌面端更新';
    message.textContent = next.message || '';
    meta.textContent = next.meta || '';
    primaryBtn.textContent = next.primaryText || '确定';
    secondaryBtn.textContent = next.secondaryText || '关闭';
    primaryBtn.style.display = next.primaryText ? 'inline-block' : 'none';
    secondaryBtn.style.display = next.secondaryText ? 'inline-block' : 'none';
    primaryBtn.onclick = next.primaryAction || null;
    secondaryBtn.onclick = next.secondaryAction || hideBanner;
    if (next.showProgress) {
      progressWrap.classList.add('show');
    } else {
      hideProgress();
    }
  }

  window.electronAPI.updates.getState().then(function(state) {
    if (!state || !state.currentVersion) return;
    setState({
      title: '桌面端已接入自动更新',
      message: '当前版本 ' + state.currentVersion + '，应用启动后会自动检查是否有新版本。',
      meta: '检测到新版本后，你可以后台下载，并在重新打开应用时自动安装。',
      primaryText: '立即检查',
      secondaryText: '知道了',
      primaryAction: function() {
        window.electronAPI.updates.checkNow();
      }
    });
  }).catch(function() {});

  window.electronAPI.updates.onChecking(function() {
    setState({
      title: '正在检查更新',
      message: '应用正在连接更新服务，检查是否有新的 Windows 版本。',
      meta: '更新源：https://zonya.work/releases/',
      primaryText: '',
      secondaryText: '关闭'
    });
  });

  window.electronAPI.updates.onAvailable(function(payload) {
    setState({
      title: '发现新版本 ' + (payload && payload.version ? payload.version : ''),
      message: '检测到新版本，建议先下载更新包。下载完成后，重新打开应用时会自动安装。',
      meta: payload && payload.releaseDate ? ('发布时间：' + payload.releaseDate) : '支持后台下载，不影响当前登录。',
      primaryText: '开始下载',
      secondaryText: '稍后',
      primaryAction: function() {
        window.electronAPI.updates.startDownload();
      }
    });
  });

  window.electronAPI.updates.onNotAvailable(function(payload) {
    setState({
      title: '当前已是最新版本',
      message: '未检测到新的桌面端版本，可以继续登录使用。',
      meta: payload && payload.version ? ('当前版本：' + payload.version) : '',
      primaryText: '',
      secondaryText: '关闭'
    });
  });

  window.electronAPI.updates.onProgress(function(payload) {
    const percent = payload && typeof payload.percent === 'number' ? payload.percent : 0;
    setState({
      title: '正在下载更新',
      message: '安装包已在后台下载，下载完成后会提示你立即安装或下次启动自动安装。',
      meta: '下载进度：' + percent + '%',
      primaryText: '',
      secondaryText: '后台继续',
      secondaryAction: hideBanner,
      showProgress: true
    });
    progressBar.style.width = Math.max(0, Math.min(100, percent)) + '%';
  });

  window.electronAPI.updates.onDownloaded(function(payload) {
    setState({
      title: '更新已下载完成',
      message: '新版本安装包已经准备好。你可以现在立即安装，也可以稍后重新打开应用时自动安装。',
      meta: payload && payload.version ? ('待安装版本：' + payload.version) : '',
      primaryText: '立即安装',
      secondaryText: '下次启动安装',
      primaryAction: function() {
        window.electronAPI.updates.installNow();
      },
      secondaryAction: hideBanner
    });
  });

  window.electronAPI.updates.onError(function(payload) {
    setState({
      title: '更新检查失败',
      message: '自动更新暂时不可用，不影响当前登录。',
      meta: payload && payload.message ? ('原因：' + payload.message) : '',
      primaryText: '重新检查',
      secondaryText: '关闭',
      primaryAction: function() {
        window.electronAPI.updates.checkNow();
      }
    });
  });
}

// 显示蜻蜓Chat登录弹窗
function showChatLoginModal() {
  const existing = document.getElementById('chat-login-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'chat-login-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <div class="modal-logo">🦋</div>
        <h3 class="modal-title">蜻蜓Chat 登录</h3>
        <p class="modal-desc">使用蜻蜓Chat账号快捷登录</p>
      </div>
      <div class="modal-form">
        <input type="text" id="chat-username" placeholder="请输入蜻蜓Chat用户名">
        <input type="password" id="chat-password" placeholder="请输入密码">
        <button class="modal-btn modal-btn-primary" onclick="chatAccountLogin()">登录蜻蜓Chat</button>
      </div>
      <div class="modal-actions">
        <button class="modal-btn-secondary" onclick="closeChatLoginModal()">取消</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // 点击背景关闭
  modal.addEventListener('click', function(e) {
    if (e.target === modal) closeChatLoginModal();
  });

  // 聚焦到用户名输入框
  document.getElementById('chat-username').focus();
}

function closeChatLoginModal() {
  const modal = document.getElementById('chat-login-modal');
  if (modal) modal.remove();
}

// 蜻蜓Chat账号登录
function chatAccountLogin() {
  const username = document.getElementById('chat-username').value.trim();
  const password = document.getElementById('chat-password').value;

  if (!username || !password) {
    alert('请输入蜻蜓Chat用户名和密码');
    return;
  }

  fetch('/api/users/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: username, password: password })
  }).then(function(resp) {
    return resp.json();
  }).then(function(result) {
    if (!result.success) {
      alert(result.message || '登录失败');
      return;
    }
    const userInfo = Object.assign({}, result.data, {
      chatUser: username,
      loginMethod: 'chat',
      isLoggedIn: true
    });
    localStorage.setItem('userInfo', JSON.stringify(userInfo));
    localStorage.setItem('currentUserId', userInfo.id);
    localStorage.setItem('currentUserDb', userInfo.currentUserDb || userInfo.localDbFile || '');
    closeChatLoginModal();
    window.location.href = 'index.html';
  }).catch(function(err) {
    alert('登录失败：' + err.message);
  });
}

// 微信登录
function wechatLogin() {
  localStorage.setItem('userInfo', JSON.stringify({
    phone: 'wechat_user',
    userType: 'personal',
    isLoggedIn: true,
    loginMethod: 'wechat'
  }));
  window.location.href = 'index.html';
}

// 支付宝登录
function alipayLogin() {
  localStorage.setItem('userInfo', JSON.stringify({
    phone: 'alipay_user',
    userType: 'personal',
    isLoggedIn: true,
    loginMethod: 'alipay'
  }));
  window.location.href = 'index.html';
}

// 显示找回密码弹窗
function showForgotPassword() {
  const existing = document.getElementById('forgot-password-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'forgot-password-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">找回密码</h3>
      </div>
      <div class="modal-form">
        <div style="margin-bottom:8px;">
          <label style="display:block;margin-bottom:6px;color:#3a4654;font-size:13px;font-weight:500;">手机号</label>
          <input type="tel" id="reset-phone" placeholder="请输入注册手机号">
        </div>
        <div style="margin-bottom:8px;">
          <label style="display:block;margin-bottom:6px;color:#3a4654;font-size:13px;font-weight:500;">验证码</label>
          <div style="display:flex;gap:10px;">
            <input type="text" id="reset-code" placeholder="请输入验证码" style="flex:1;">
            <button id="send-reset-code-btn" style="padding:0 16px;background:linear-gradient(135deg,#388bfd,#5b6ef5);color:#fff;border:none;border-radius:8px;font-size:13px;cursor:pointer;white-space:nowrap;">获取验证码</button>
          </div>
          <div id="reset-debug-code" style="display:none;margin-top:10px;padding:10px 12px;border-radius:8px;background:#fff7e8;border:1px solid #f2c97d;color:#8a5a00;font-size:13px;line-height:1.7;"></div>
        </div>
        <div style="margin-bottom:8px;">
          <label style="display:block;margin-bottom:6px;color:#3a4654;font-size:13px;font-weight:500;">新密码</label>
          <input type="password" id="reset-password" placeholder="至少6位，字母+数字">
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block;margin-bottom:6px;color:#3a4654;font-size:13px;font-weight:500;">确认新密码</label>
          <input type="password" id="reset-password-confirm" placeholder="请再次输入新密码">
        </div>
        <button class="modal-btn modal-btn-primary" onclick="resetPassword()">确认重置</button>
      </div>
      <div class="modal-actions">
        <button class="modal-btn-secondary" onclick="closeForgotPassword()">取消</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('send-reset-code-btn').addEventListener('click', sendResetCode);

  modal.addEventListener('click', function(e) {
    if (e.target === modal) closeForgotPassword();
  });
}

function closeForgotPassword() {
  const modal = document.getElementById('forgot-password-modal');
  if (modal) modal.remove();
}

function showResetSuccess(message, phone) {
  const existing = document.getElementById('reset-success-banner');
  if (existing) existing.remove();
  const banner = document.createElement('div');
  banner.id = 'reset-success-banner';
  banner.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);z-index:9999;background:linear-gradient(135deg,#0f9d58,#38c172);color:#fff;padding:14px 18px;border-radius:14px;box-shadow:0 10px 24px rgba(15,157,88,.25);font-size:14px;font-weight:600;max-width:90vw;text-align:center;';
  banner.textContent = message || '密码已重置，请使用新密码登录';
  document.body.appendChild(banner);
  setTimeout(function() {
    if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
  }, 3500);
  const accountInput = document.getElementById('account');
  const passwordInput = document.getElementById('password');
  if (accountInput && phone) {
    accountInput.value = phone;
    accountInput.dispatchEvent(new Event('input'));
    accountInput.focus();
  }
  if (passwordInput) {
    passwordInput.value = '';
    passwordInput.placeholder = '请输入刚刚重置后的新密码';
  }
}

function sendResetCode() {
  const phone = document.getElementById('reset-phone').value;
  if (!phone) {
    alert('请输入手机号');
    return;
  }
  if (!/^1[3-9]\d{9}$/.test(phone)) {
    alert('请输入正确的手机号码');
    return;
  }
  const btn = document.getElementById('send-reset-code-btn');
  fetch('/api/sms/send-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: phone, purpose: 'reset_password' })
  }).then(function(resp) {
    return resp.json();
  }).then(function(result) {
    if (!result.success) {
      alert(result.message || '验证码发送失败');
      return;
    }
    btn.disabled = true;
    btn.style.opacity = '0.6';
    let countdown = 60;
    btn.textContent = countdown + 's';
    const timer = setInterval(function() {
      countdown--;
      btn.textContent = countdown + 's';
      if (countdown <= 0) {
        clearInterval(timer);
        btn.textContent = '获取验证码';
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    }, 1000);
    let msg = result.message || '验证码已发送';
    if (result.debugCode) msg += '（测试验证码：' + result.debugCode + '）';
    const debugBanner = document.getElementById('reset-debug-code');
    if (debugBanner) {
      if (result.mode === 'debug' && result.debugCode) {
        debugBanner.textContent = '当前为测试模式，短信未实际发送。请直接使用验证码：' + result.debugCode;
        debugBanner.style.display = 'block';
      } else {
        debugBanner.textContent = '';
        debugBanner.style.display = 'none';
      }
    }
    alert(msg);
  }).catch(function(err) {
    alert('验证码发送失败：' + err.message);
  });
}

function validatePassword(password) {
  if (password.length < 6) {
    return '密码至少6位';
  }
  if (!/[a-zA-Z]/.test(password)) {
    return '密码必须包含字母';
  }
  if (!/[0-9]/.test(password)) {
    return '密码必须包含数字';
  }
  return null;
}

function resetPassword() {
  const phone = document.getElementById('reset-phone').value;
  const code = document.getElementById('reset-code').value;
  const password = document.getElementById('reset-password').value;
  const passwordConfirm = document.getElementById('reset-password-confirm').value;

  if (!phone || !code || !password || !passwordConfirm) {
    alert('请填写所有字段');
    return;
  }

  const pwdError = validatePassword(password);
  if (pwdError) {
    alert(pwdError);
    return;
  }

  if (password !== passwordConfirm) {
    alert('两次输入的密码不一致');
    return;
  }

  fetch('/api/users/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: phone, code: code, password: password })
  }).then(function(resp) {
    return resp.json();
  }).then(function(result) {
    if (!result.success) {
      alert(result.message || '密码重置失败');
      return;
    }
    closeForgotPassword();
    showResetSuccess('密码重置成功，请直接使用新密码登录', phone);
  }).catch(function(err) {
    alert('密码重置失败：' + err.message);
  });
}
