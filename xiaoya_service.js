// 小雅客服功能
function initXiaoyaService() {
  // 创建小雅客服HTML
  const xiaoyaHTML = `
    <!-- 悬浮客服助手 -->
    <div class="customer-service">
      <div class="service-icon" id="service-icon">
        <div class="icon">💬</div>
        <div class="name">小雅客服</div>
      </div>
      <div class="service-panel" id="service-panel">
        <div class="service-header">
          <h3>小雅客服</h3>
          <button class="service-close" id="service-close">×</button>
        </div>
        <div class="service-content">
          <div class="service-item">
            <h4>在线咨询</h4>
            <p>专业客服为您解答问题</p>
          </div>
          <div class="service-item">
            <h4>技术支持</h4>
            <p>软件使用问题解决方案</p>
          </div>
          <div class="service-item">
            <h4>产品咨询</h4>
            <p>了解更多产品功能</p>
          </div>
          <div class="service-item">
            <h4>意见反馈</h4>
            <p>提交您的宝贵建议</p>
          </div>
        </div>
      </div>
    </div>
    
    <style>
      .customer-service {
        position: fixed;
        bottom: 120px;
        right: 30px;
        z-index: 9998;
      }
      
      .service-icon {
        width: 60px;
        height: 60px;
        background-color: #3498db;
        border-radius: 50%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
        transition: all 0.3s;
      }
      
      .service-icon:hover {
        transform: scale(1.1);
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
      }
      
      .service-icon .icon {
        font-size: 24px;
        color: white;
      }
      
      .service-icon .name {
        font-size: 12px;
        color: white;
        margin-top: 2px;
      }
      
      .service-panel {
        position: absolute;
        bottom: 70px;
        right: 0;
        width: 300px;
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        display: none;
        flex-direction: column;
        overflow: hidden;
      }
      
      .service-panel.active {
        display: flex;
      }
      
      .service-header {
        background-color: #3498db;
        color: white;
        padding: 15px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .service-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: bold;
      }
      
      .service-close {
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .service-content {
        padding: 20px;
      }
      
      .service-item {
        margin-bottom: 20px;
      }
      
      .service-item:last-child {
        margin-bottom: 0;
      }
      
      .service-item h4 {
        margin: 0 0 5px 0;
        font-size: 14px;
        color: #2c3e50;
      }
      
      .service-item p {
        margin: 0;
        font-size: 12px;
        color: #7f8c8d;
      }
    </style>
  `;
  
  // 将小雅客服添加到页面底部
  document.body.insertAdjacentHTML('beforeend', xiaoyaHTML);
  
  // 绑定事件
  const serviceIcon = document.getElementById('service-icon');
  const servicePanel = document.getElementById('service-panel');
  const serviceClose = document.getElementById('service-close');
  
  if (serviceIcon && servicePanel && serviceClose) {
    // 点击客服图标
    serviceIcon.addEventListener('click', function() {
      servicePanel.classList.toggle('active');
    });
    
    // 点击关闭按钮
    serviceClose.addEventListener('click', function() {
      servicePanel.classList.remove('active');
    });
    
    // 点击页面其他地方关闭
    document.addEventListener('click', function(e) {
      if (!serviceIcon.contains(e.target) && !servicePanel.contains(e.target)) {
        servicePanel.classList.remove('active');
      }
    });
  }
}

// 初始化小雅客服
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    initXiaoyaService();
  });
} else {
  initXiaoyaService();
}
