// 小雅客服功能
function initXiaoyaService() {
  console.log('初始化小雅客服...');
  
  // 检查是否已存在小雅客服
  if (document.getElementById('xiaoya-service')) {
    console.log('小雅客服已存在，跳过初始化');
    return;
  }
  
  // 创建小雅客服HTML
  const xiaoyaHTML = `
    <!-- 悬浮客服助手 -->
    <div class="customer-service" id="xiaoya-service" style="position: fixed; bottom: 120px; right: 30px; z-index: 9998;">
      <div class="service-icon" id="service-icon" style="width: 60px; height: 60px; background-color: #3498db; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2); transition: all 0.3s;">
        <div class="icon" style="font-size: 24px; color: white;">💬</div>
        <div class="name" style="font-size: 12px; color: white; margin-top: 2px;">小雅客服</div>
      </div>
      <div class="service-panel" id="service-panel" style="position: absolute; bottom: 70px; right: 0; width: 300px; background-color: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15); display: none; flex-direction: column; overflow: hidden;">
        <div class="service-header" style="background-color: #3498db; color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 16px; font-weight: bold;">小雅客服</h3>
          <button class="service-close" id="service-close" style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; padding: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">×</button>
        </div>
        <div class="service-content" style="padding: 20px;">
          <div class="service-item" style="margin-bottom: 20px; cursor: pointer; padding: 10px; border-radius: 4px; transition: background-color 0.3s;" onmouseover="this.style.backgroundColor='#f8f9fa'" onmouseout="this.style.backgroundColor='transparent'">
            <h4 style="margin: 0 0 5px 0; font-size: 14px; color: #2c3e50;">在线咨询</h4>
            <p style="margin: 0; font-size: 12px; color: #7f8c8d;">专业客服为您解答问题</p>
          </div>
          <div class="service-item" style="margin-bottom: 20px; cursor: pointer; padding: 10px; border-radius: 4px; transition: background-color 0.3s;" onmouseover="this.style.backgroundColor='#f8f9fa'" onmouseout="this.style.backgroundColor='transparent'">
            <h4 style="margin: 0 0 5px 0; font-size: 14px; color: #2c3e50;">技术支持</h4>
            <p style="margin: 0; font-size: 12px; color: #7f8c8d;">软件使用问题解决方案</p>
          </div>
          <div class="service-item" style="margin-bottom: 20px; cursor: pointer; padding: 10px; border-radius: 4px; transition: background-color 0.3s;" onmouseover="this.style.backgroundColor='#f8f9fa'" onmouseout="this.style.backgroundColor='transparent'">
            <h4 style="margin: 0 0 5px 0; font-size: 14px; color: #2c3e50;">产品咨询</h4>
            <p style="margin: 0; font-size: 12px; color: #7f8c8d;">了解更多产品功能</p>
          </div>
          <div class="service-item" style="cursor: pointer; padding: 10px; border-radius: 4px; transition: background-color 0.3s;" onmouseover="this.style.backgroundColor='#f8f9fa'" onmouseout="this.style.backgroundColor='transparent'">
            <h4 style="margin: 0 0 5px 0; font-size: 14px; color: #2c3e50;">意见反馈</h4>
            <p style="margin: 0; font-size: 12px; color: #7f8c8d;">提交您的宝贵建议</p>
          </div>
        </div>
      </div>
    </div>
  `;
  
  // 将小雅客服添加到页面底部
  document.body.insertAdjacentHTML('beforeend', xiaoyaHTML);
  console.log('小雅客服HTML已添加');
  
  // 绑定事件
  const serviceIcon = document.getElementById('service-icon');
  const servicePanel = document.getElementById('service-panel');
  const serviceClose = document.getElementById('service-close');
  
  console.log('获取元素:', { serviceIcon: !!serviceIcon, servicePanel: !!servicePanel, serviceClose: !!serviceClose });
  
  if (serviceIcon && servicePanel && serviceClose) {
    console.log('绑定事件...');
    
    // 点击客服图标 - 使用onclick确保只有一个事件处理器
    serviceIcon.onclick = function(e) {
      e.stopPropagation();
      console.log('点击客服图标');
      const isVisible = servicePanel.style.display === 'flex';
      servicePanel.style.display = isVisible ? 'none' : 'flex';
      console.log('面板状态:', servicePanel.style.display);
    };
    
    // 点击关闭按钮
    serviceClose.onclick = function(e) {
      e.stopPropagation();
      console.log('点击关闭按钮');
      servicePanel.style.display = 'none';
    };
    
    // 点击页面其他地方关闭
    document.addEventListener('click', function(e) {
      const xiaoyaService = document.getElementById('xiaoya-service');
      if (xiaoyaService && !xiaoyaService.contains(e.target)) {
        servicePanel.style.display = 'none';
      }
    });
    
    // 点击服务项目
    const serviceItems = document.querySelectorAll('.service-item');
    serviceItems.forEach(function(item) {
      item.onclick = function(e) {
        e.stopPropagation();
        const serviceName = this.querySelector('h4').textContent;
        console.log('点击服务项目:', serviceName);
        alert('您选择了：' + serviceName + '\n我们的客服将尽快为您服务！');
        servicePanel.style.display = 'none';
      };
    });
    
    console.log('事件绑定完成');
  } else {
    console.error('未能获取到小雅客服元素');
  }
}

// 初始化小雅客服
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOMContentLoaded - 准备初始化小雅客服');
  initXiaoyaService();
});

// 如果DOM已经加载完成，立即初始化
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  console.log('DOM已加载，立即初始化小雅客服');
  initXiaoyaService();
}