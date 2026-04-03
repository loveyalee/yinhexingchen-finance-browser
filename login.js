function handleLogin() {
  const phone = document.getElementById('phone').value;
  const password = document.getElementById('password').value;
  
  // 模拟登录验证
  if (phone && password) {
    // 模拟用户类型，实际应用中应该从服务器获取
    const userType = 'personal'; // 可以根据实际情况设置为'personal'或'enterprise'
    
    // 保存用户信息到localStorage
    localStorage.setItem('userInfo', JSON.stringify({
      phone: phone,
      userType: userType,
      isLoggedIn: true
    }));
    
    // 直接跳转到主页
    window.location.href = 'index.html';
  } else {
    alert('请输入手机号和密码');
  }
}

function wechatLogin() {
  alert('微信登录功能已触发，请使用微信扫码登录');
  // 模拟登录成功
  const userType = 'personal'; // 可以根据实际情况设置为'personal'或'enterprise'
  
  // 保存用户信息到localStorage
  localStorage.setItem('userInfo', JSON.stringify({
    phone: 'wechat_user',
    userType: userType,
    isLoggedIn: true
  }));
  
  // 直接跳转到主页
  window.location.href = 'index.html';
}

function alipayLogin() {
  alert('支付宝登录功能已触发，请使用支付宝扫码登录');
  // 模拟登录成功
  const userType = 'personal'; // 可以根据实际情况设置为'personal'或'enterprise'
  
  // 保存用户信息到localStorage
  localStorage.setItem('userInfo', JSON.stringify({
    phone: 'alipay_user',
    userType: userType,
    isLoggedIn: true
  }));
  
  // 直接跳转到主页
  window.location.href = 'index.html';
}

document.addEventListener('DOMContentLoaded', function() {
  const loginForm = document.getElementById('login-form');
  const loginButton = document.querySelector('.btn-primary');
  const wechatButton = document.querySelector('.social-btn.wechat');
  const alipayButton = document.querySelector('.social-btn.alipay');
  
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      handleLogin();
    });
  }
  
  if (loginButton) {
    loginButton.addEventListener('click', handleLogin);
  }
  
  if (wechatButton) {
    wechatButton.addEventListener('click', wechatLogin);
  }
  
  if (alipayButton) {
    alipayButton.addEventListener('click', alipayLogin);
  }
});