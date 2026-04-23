/**
 * 用户菜单动态更新
 * 根据用户类型（个人/企业/机构）动态更新导航菜单显示
 */

(function() {
  // 更新导航菜单中的用户相关显示
  function updateUserMenuDisplay() {
    try {
      const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      const userType = userInfo.userType || 'personal';

      // 更新"我的会员"菜单标题
      const memberMenuLinks = document.querySelectorAll('.nav-item.has-submenu > a');
      memberMenuLinks.forEach(function(link) {
        // 只针对"我的会员"相关的菜单，不影响"企业管理"等其他菜单
        if (link.textContent.includes('我的会员') || link.textContent.includes('企业会员') || link.textContent.includes('机构会员')) {
          if (userType === 'enterprise') {
            link.textContent = '管理中心';
          } else if (userType === 'institution') {
            link.textContent = '机构会员';
          } else {
            link.textContent = '我的会员';
          }
        }
      });

      // 更新二级菜单中的"个人中心"
      const submenuLinks = document.querySelectorAll('.submenu-item a[href="member.html"]');
      submenuLinks.forEach(function(link) {
        if (userType === 'enterprise') {
          link.textContent = '企业会员';
        } else if (userType === 'institution') {
          link.textContent = '机构会员';
        } else {
          link.textContent = '个人中心';
        }
      });

      // 企业用户显示"企业管理"菜单
      const enterpriseMenus = document.querySelectorAll('.enterprise-menu');
      enterpriseMenus.forEach(function(menu) {
        if (userType === 'enterprise') {
          menu.style.display = '';
        } else {
          menu.style.display = 'none';
        }
      });

      // 更新页面标题（如果在 member.html 页面）
      const headerTitle = document.querySelector('.header h1');
      if (headerTitle && window.location.pathname.includes('member.html')) {
        if (userType === 'enterprise') {
          headerTitle.textContent = '管理中心';
        } else if (userType === 'institution') {
          headerTitle.textContent = '机构会员中心';
        } else {
          headerTitle.textContent = '我的会员';
        }
      }

      console.log('用户菜单已更新，用户类型:', userType);
    } catch (e) {
      console.error('更新用户菜单失败:', e);
    }
  }

  // 获取用户显示名称
  function getUserDisplayName() {
    try {
      const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      // 企业用户显示企业名称或手机号
      if (userInfo.userType === 'enterprise') {
        return userInfo.enterpriseName || userInfo.username || userInfo.phone || '企业用户';
      }
      // 机构用户显示机构名称
      if (userInfo.userType === 'institution') {
        return userInfo.institutionName || userInfo.username || userInfo.phone || '机构用户';
      }
      // 个人用户显示用户名或手机号
      return userInfo.username || userInfo.phone || '用户';
    } catch (e) {
      return '用户';
    }
  }

  // 页面加载完成后执行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateUserMenuDisplay);
  } else {
    updateUserMenuDisplay();
  }

  // 暴露到全局
  window.updateUserMenuDisplay = updateUserMenuDisplay;
  window.getUserDisplayName = getUserDisplayName;
})();
