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
});

// 统一登录处理
function handleLogin() {
  const account = document.getElementById('account').value.trim();
  const password = document.getElementById('password').value;

  if (!account || !password) {
    alert('请输入账号和密码');
    return;
  }

  const accountType = detectAccountType(account);

  if (accountType === 'unknown') {
    alert('请输入正确的手机号、邮箱或身份证号');
    return;
  }

  // 根据账号类型处理
  let userInfo = {
    userType: 'personal',
    isLoggedIn: true,
    loginMethod: accountType
  };

  switch (accountType) {
    case 'phone':
      userInfo.phone = account;
      break;
    case 'email':
      userInfo.email = account;
      break;
    case 'idcard':
      userInfo.idcard = account;
      // 提取出生日期
      const birthYear = account.substring(6, 10);
      const birthMonth = account.substring(10, 12);
      const birthDay = account.substring(12, 14);
      userInfo.birthDate = `${birthYear}-${birthMonth}-${birthDay}`;
      userInfo.realNameVerified = true;
      break;
  }

  localStorage.setItem('userInfo', JSON.stringify(userInfo));
  window.location.href = 'index.html';
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

  localStorage.setItem('userInfo', JSON.stringify({
    phone: username,
    userType: 'personal',
    isLoggedIn: true,
    chatUser: username,
    loginMethod: 'chat'
  }));

  closeChatLoginModal();
  window.location.href = 'index.html';
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
  alert('验证码已发送到您的手机');
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

  alert('密码重置成功！请使用新密码登录');
  closeForgotPassword();
}
