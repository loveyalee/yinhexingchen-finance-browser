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
          <div class="service-item" data-service="online" style="margin-bottom: 20px; cursor: pointer; padding: 10px; border-radius: 4px; transition: background-color 0.3s;" onmouseover="this.style.backgroundColor='#f8f9fa'" onmouseout="this.style.backgroundColor='transparent'">
            <h4 style="margin: 0 0 5px 0; font-size: 14px; color: #2c3e50;">在线咨询</h4>
            <p style="margin: 0; font-size: 12px; color: #7f8c8d;">专业客服为您解答问题</p>
          </div>
          <div class="service-item" data-service="support" style="margin-bottom: 20px; cursor: pointer; padding: 10px; border-radius: 4px; transition: background-color 0.3s;" onmouseover="this.style.backgroundColor='#f8f9fa'" onmouseout="this.style.backgroundColor='transparent'">
            <h4 style="margin: 0 0 5px 0; font-size: 14px; color: #2c3e50;">技术支持</h4>
            <p style="margin: 0; font-size: 12px; color: #7f8c8d;">软件使用问题解决方案</p>
          </div>
          <div class="service-item" data-service="product" style="margin-bottom: 20px; cursor: pointer; padding: 10px; border-radius: 4px; transition: background-color 0.3s;" onmouseover="this.style.backgroundColor='#f8f9fa'" onmouseout="this.style.backgroundColor='transparent'">
            <h4 style="margin: 0 0 5px 0; font-size: 14px; color: #2c3e50;">产品咨询</h4>
            <p style="margin: 0; font-size: 12px; color: #7f8c8d;">了解更多产品功能</p>
          </div>
          <div class="service-item" data-service="feedback" style="cursor: pointer; padding: 10px; border-radius: 4px; transition: background-color 0.3s;" onmouseover="this.style.backgroundColor='#f8f9fa'" onmouseout="this.style.backgroundColor='transparent'">
            <h4 style="margin: 0 0 5px 0; font-size: 14px; color: #2c3e50;">意见反馈</h4>
            <p style="margin: 0; font-size: 12px; color: #7f8c8d;">提交您的宝贵建议</p>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 聊天窗口 -->
    <div id="chat-window" style="display: none; position: fixed; bottom: 120px; right: 30px; width: 350px; height: 500px; background-color: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15); z-index: 10001; flex-direction: column; overflow: hidden;">
      <div style="background-color: #3498db; color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h3 style="margin: 0; font-size: 16px; font-weight: bold;">在线客服</h3>
          <p style="margin: 5px 0 0 0; font-size: 12px; opacity: 0.9;">小雅为您服务</p>
        </div>
        <button id="chat-close" style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; padding: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">×</button>
      </div>
      <div id="chat-messages" style="flex: 1; padding: 15px; overflow-y: auto; background-color: #f8f9fa;">
        <div style="text-align: center; color: #95a5a6; font-size: 12px; margin-bottom: 15px;">今天</div>
        <div style="display: flex; margin-bottom: 15px;">
          <div style="width: 36px; height: 36px; border-radius: 50%; background-color: #3498db; color: white; display: flex; align-items: center; justify-content: center; font-size: 14px; margin-right: 10px; flex-shrink: 0;">雅</div>
          <div style="background-color: white; padding: 10px 15px; border-radius: 18px; border-bottom-left-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); max-width: 70%;">
            <p style="margin: 0; font-size: 14px; color: #333;">您好！我是小雅，请问有什么可以帮您？</p>
          </div>
        </div>
      </div>
      <div style="padding: 10px 15px; border-top: 1px solid #e0e0e0; background-color: #f8f9fa;">
        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
          <input type="text" id="chat-input" placeholder="输入消息..." style="flex: 1; padding: 10px; border: 1px solid #e0e0e0; border-radius: 20px; outline: none; font-size: 14px;">
          <button id="chat-send" style="width: 40px; height: 40px; border: none; background-color: #3498db; color: white; border-radius: 50%; cursor: pointer; font-size: 16px;">➤</button>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span id="chat-status" style="font-size: 12px; color: #27ae60;">🤖 AI智能客服为您服务</span>
          <button id="transfer-to-human" style="padding: 6px 12px; background-color: #e74c3c; color: white; border: none; border-radius: 15px; cursor: pointer; font-size: 12px;">转人工客服</button>
        </div>
      </div>
    </div>
    
    <!-- 技术支持文档窗口 -->
    <div id="support-window" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 600px; max-width: 90%; max-height: 80%; background-color: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15); z-index: 10000; flex-direction: column; overflow: hidden;">
      <div style="background-color: #3498db; color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; font-size: 16px; font-weight: bold;">技术支持文档</h3>
        <button id="support-close" style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; padding: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">×</button>
      </div>
      <div style="padding: 20px; overflow-y: auto; flex: 1;">
        <div style="margin-bottom: 20px;">
          <h4 style="color: #2c3e50; margin-bottom: 10px;">📖 常见问题</h4>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 10px;">
            <h5 style="margin: 0 0 5px 0; color: #34495e;">Q: 如何登录系统？</h5>
            <p style="margin: 0; font-size: 13px; color: #666;">A: 在登录页面输入您的账号和密码，点击登录按钮即可。</p>
          </div>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 10px;">
            <h5 style="margin: 0 0 5px 0; color: #34495e;">Q: 忘记密码怎么办？</h5>
            <p style="margin: 0; font-size: 13px; color: #666;">A: 点击登录页面的"忘记密码"链接，按照提示重置密码。</p>
          </div>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
            <h5 style="margin: 0 0 5px 0; color: #34495e;">Q: 如何联系客服？</h5>
            <p style="margin: 0; font-size: 13px; color: #666;">A: 点击页面右下角的小雅客服图标，选择在线咨询即可。</p>
          </div>
        </div>
        <div>
          <h4 style="color: #2c3e50; margin-bottom: 10px;">📞 联系方式</h4>
          <p style="margin: 5px 0; font-size: 14px; color: #666;">客服热线：400-888-8888</p>
          <p style="margin: 5px 0; font-size: 14px; color: #666;">服务时间：周一至周日 9:00-21:00</p>
          <p style="margin: 5px 0; font-size: 14px; color: #666;">邮箱：support@yinhexingchen.com</p>
        </div>
      </div>
    </div>
    
    <!-- 产品咨询窗口 -->
    <div id="product-window" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 600px; max-width: 90%; max-height: 80%; background-color: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15); z-index: 10000; flex-direction: column; overflow: hidden;">
      <div style="background-color: #27ae60; color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; font-size: 16px; font-weight: bold;">产品咨询</h3>
        <button id="product-close" style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; padding: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">×</button>
      </div>
      <div style="padding: 20px; overflow-y: auto; flex: 1;">
        <div style="margin-bottom: 20px;">
          <h4 style="color: #2c3e50; margin-bottom: 15px;">🌟 银河星辰财务浏览器</h4>
          <p style="margin: 0 0 15px 0; font-size: 14px; color: #666; line-height: 1.6;">专为财务人员打造的智能浏览器，集成多种财务工具，提升工作效率。</p>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
              <h5 style="margin: 0 0 5px 0; color: #34495e;">📊 财务报表</h5>
              <p style="margin: 0; font-size: 12px; color: #666;">自动生成各类财务报表</p>
            </div>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
              <h5 style="margin: 0 0 5px 0; color: #34495e;">🧾 发票管理</h5>
              <p style="margin: 0; font-size: 12px; color: #666;">电子发票统一管理</p>
            </div>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
              <h5 style="margin: 0 0 5px 0; color: #34495e;">📋 合同管理</h5>
              <p style="margin: 0; font-size: 12px; color: #666;">合同全生命周期管理</p>
            </div>
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
              <h5 style="margin: 0 0 5px 0; color: #34495e;">💼 电子印章</h5>
              <p style="margin: 0; font-size: 12px; color: #666;">安全电子签章服务</p>
            </div>
          </div>
        </div>
        <div style="text-align: center; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">想了解更多产品详情？</p>
          <button onclick="window.open('https://zonya.work', '_blank')" style="padding: 10px 20px; background-color: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">访问官网</button>
        </div>
      </div>
    </div>
    
    <!-- 意见反馈窗口 -->
    <div id="feedback-window" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 500px; max-width: 90%; background-color: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15); z-index: 10000; flex-direction: column; overflow: hidden;">
      <div style="background-color: #f39c12; color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; font-size: 16px; font-weight: bold;">意见反馈</h3>
        <button id="feedback-close" style="background: none; border: none; color: white; font-size: 18px; cursor: pointer; padding: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">×</button>
      </div>
      <div style="padding: 20px;">
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #2c3e50; font-size: 14px;">反馈类型</label>
          <select id="feedback-type" style="width: 100%; padding: 10px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px;">
            <option value="suggestion">功能建议</option>
            <option value="bug">问题反馈</option>
            <option value="complaint">投诉</option>
            <option value="other">其他</option>
          </select>
        </div>
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #2c3e50; font-size: 14px;">您的姓名</label>
          <input type="text" id="feedback-name" placeholder="请输入您的姓名" style="width: 100%; padding: 10px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px;">
        </div>
        <div style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #2c3e50; font-size: 14px;">联系电话</label>
          <input type="text" id="feedback-phone" placeholder="请输入您的联系电话" style="width: 100%; padding: 10px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px;">
        </div>
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #2c3e50; font-size: 14px;">反馈内容</label>
          <textarea id="feedback-content" placeholder="请详细描述您的意见或建议..." rows="4" style="width: 100%; padding: 10px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px; resize: vertical;"></textarea>
        </div>
        <div style="display: flex; justify-content: flex-end; gap: 10px;">
          <button id="feedback-cancel" style="padding: 10px 20px; background-color: #95a5a6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">取消</button>
          <button id="feedback-submit" style="padding: 10px 20px; background-color: #f39c12; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">提交反馈</button>
        </div>
      </div>
    </div>
    
    <!-- 遮罩层 -->
    <div id="overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); z-index: 9999;"></div>
  `;
  
  // 将小雅客服添加到页面底部
  document.body.insertAdjacentHTML('beforeend', xiaoyaHTML);
  console.log('小雅客服HTML已添加');
  
  // 绑定事件
  const serviceIcon = document.getElementById('service-icon');
  const servicePanel = document.getElementById('service-panel');
  const serviceClose = document.getElementById('service-close');
  const overlay = document.getElementById('overlay');
  
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
        const serviceType = this.getAttribute('data-service');
        const serviceName = this.querySelector('h4').textContent;
        console.log('点击服务项目:', serviceName, '类型:', serviceType);
        
        // 关闭服务面板
        servicePanel.style.display = 'none';
        
        // 根据服务类型执行不同操作
        switch(serviceType) {
          case 'online':
            openChatWindow();
            break;
          case 'support':
            openSupportWindow();
            break;
          case 'product':
            openProductWindow();
            break;
          case 'feedback':
            openFeedbackWindow();
            break;
        }
      };
    });
    
    // 聊天窗口功能
    bindChatWindowEvents();
    
    // 技术支持窗口功能
    bindSupportWindowEvents();
    
    // 产品咨询窗口功能
    bindProductWindowEvents();
    
    // 意见反馈窗口功能
    bindFeedbackWindowEvents();
    
    console.log('事件绑定完成');
  } else {
    console.error('未能获取到小雅客服元素');
  }
}

// 打开聊天窗口
function openChatWindow() {
  const chatWindow = document.getElementById('chat-window');
  const overlay = document.getElementById('overlay');
  if (chatWindow) {
    chatWindow.style.display = 'flex';
    if (overlay) overlay.style.display = 'block';
    document.getElementById('chat-input').focus();
  }
}

// 关闭聊天窗口
function closeChatWindow() {
  const chatWindow = document.getElementById('chat-window');
  const overlay = document.getElementById('overlay');
  if (chatWindow) {
    chatWindow.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
  }
}

// 绑定聊天窗口事件
// 当前客服模式：'ai' 或 'human'
let chatMode = 'ai';

function bindChatWindowEvents() {
  const chatClose = document.getElementById('chat-close');
  const chatSend = document.getElementById('chat-send');
  const chatInput = document.getElementById('chat-input');
  const transferBtn = document.getElementById('transfer-to-human');
  
  if (chatClose) {
    chatClose.onclick = function(e) {
      e.stopPropagation();
      closeChatWindow();
    };
  }
  
  if (chatSend && chatInput) {
    chatSend.onclick = function() {
      sendChatMessage();
    };
    
    chatInput.onkeypress = function(e) {
      if (e.key === 'Enter') {
        sendChatMessage();
      }
    };
  }
  
  // 转人工客服按钮
  if (transferBtn) {
    transferBtn.onclick = function(e) {
      e.stopPropagation();
      transferToHuman();
    };
  }
}

// 转人工客服
function transferToHuman() {
  const chatStatus = document.getElementById('chat-status');
  const transferBtn = document.getElementById('transfer-to-human');
  const chatMessages = document.getElementById('chat-messages');
  
  if (chatMode === 'ai') {
    // 切换到人工模式
    chatMode = 'human';
    if (chatStatus) {
      chatStatus.innerHTML = '👨‍💼 人工客服为您服务';
      chatStatus.style.color = '#e74c3c';
    }
    if (transferBtn) {
      transferBtn.textContent = '返回AI客服';
      transferBtn.style.backgroundColor = '#3498db';
    }
    
    // 添加系统提示
    const systemMsgDiv = document.createElement('div');
    systemMsgDiv.style.cssText = 'text-align: center; margin: 15px 0;';
    systemMsgDiv.innerHTML = `
      <span style="background-color: #fff3cd; color: #856404; padding: 5px 10px; border-radius: 10px; font-size: 12px;">已为您转接人工客服，请稍候...</span>
    `;
    chatMessages.appendChild(systemMsgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    // 模拟人工客服接入
    setTimeout(function() {
      const humanMsgDiv = document.createElement('div');
      humanMsgDiv.style.cssText = 'display: flex; margin-bottom: 15px;';
      humanMsgDiv.innerHTML = `
        <div style="width: 36px; height: 36px; border-radius: 50%; background-color: #e74c3c; color: white; display: flex; align-items: center; justify-content: center; font-size: 14px; margin-right: 10px; flex-shrink: 0;">👨</div>
        <div style="background-color: white; padding: 10px 15px; border-radius: 18px; border-bottom-left-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); max-width: 70%;">
          <p style="margin: 0; font-size: 14px; color: #333; line-height: 1.5;">您好！我是人工客服小张，很高兴为您服务。请问有什么可以帮助您的？</p>
        </div>
      `;
      chatMessages.appendChild(humanMsgDiv);
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }, 1500);
    
  } else {
    // 切换回AI模式
    chatMode = 'ai';
    if (chatStatus) {
      chatStatus.innerHTML = '🤖 AI智能客服为您服务';
      chatStatus.style.color = '#27ae60';
    }
    if (transferBtn) {
      transferBtn.textContent = '转人工客服';
      transferBtn.style.backgroundColor = '#e74c3c';
    }
    
    // 添加系统提示
    const systemMsgDiv = document.createElement('div');
    systemMsgDiv.style.cssText = 'text-align: center; margin: 15px 0;';
    systemMsgDiv.innerHTML = `
      <span style="background-color: #d4edda; color: #155724; padding: 5px 10px; border-radius: 10px; font-size: 12px;">已切换回AI智能客服</span>
    `;
    chatMessages.appendChild(systemMsgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

// AI知识库 - 系统功能问答
const aiKnowledgeBase = {
  '登录': '您可以在登录页面输入账号和密码进行登录。如果忘记密码，可以点击"忘记密码"链接重置。客服登录请访问：cs_admin_login.html',
  '注册': '点击首页的"注册"按钮，填写相关信息即可完成注册。支持个人用户和第三方机构注册。',
  '发票': '我们提供完整的发票管理功能，包括发票申请、查询、下载等。您可以在"财务管理 > 发票管理"模块中使用。',
  '合同': '合同管理模块支持合同起草、审批、签署、归档等全生命周期管理。请在"财务管理 > 合同管理"中查看。',
  '印章': '电子印章管理提供安全可靠的电子签章服务，支持合同盖章、文件签署等功能。',
  '客服': '我们提供多种客服渠道：1. 在线咨询（当前窗口）2. 客服热线：400-888-8888 3. 邮箱：support@yinhexingchen.com',
  '招聘': '财务快聘平台为财务人员提供求职和企业招聘服务，分为个人求职和企业招聘两大模块。',
  '云盘': '云盘功能提供文件存储和管理服务，支持文件上传、下载、分享等操作。',
  '记账': '记账凭证模块支持凭证录入、审核、查询等功能，会计科目丰富，支持自定义。',
  '报表': '财务报表模块可自动生成资产负债表、利润表、现金流量表等各类财务报表。',
  '会员': '会员中心提供钱包、信用分、交易明细等功能，可以查看账户余额和消费记录。',
  '帮助': '您可以通过以下方式获取帮助：1. 在线咨询 2. 技术支持文档 3. 拨打客服热线 400-888-8888',
  '价格': '具体价格信息请访问官网或联系客服咨询，我们提供多种套餐供您选择。',
  '功能': '银河星辰财务浏览器主要功能包括：财务报表、发票管理、合同管理、电子印章、财务快聘、云盘存储、记账凭证、会员中心等。'
};

// AI智能回复
function getAIResponse(userMessage) {
  const message = userMessage.toLowerCase();
  
  // 关键词匹配
  for (const [keyword, response] of Object.entries(aiKnowledgeBase)) {
    if (message.includes(keyword)) {
      return response;
    }
  }
  
  // 默认回复
  const defaultResponses = [
    '您好！我是小雅，银河星辰财务浏览器的智能客服。我可以帮您了解：登录注册、发票管理、合同管理、电子印章、财务快聘、云盘存储、记账凭证等功能。请问您想了解哪方面？',
    '抱歉，我可能没理解您的问题。您可以问我关于：财务报表、发票管理、合同管理、会员中心、客服联系方式等问题。',
    '感谢您的咨询！如需更详细的帮助，您可以：1. 查看技术支持文档 2. 拨打客服热线 400-888-8888 3. 提交意见反馈'
  ];
  
  // 随机选择一个默认回复
  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

// 发送聊天消息
function sendChatMessage() {
  const chatInput = document.getElementById('chat-input');
  const chatMessages = document.getElementById('chat-messages');
  
  const message = chatInput.value.trim();
  if (!message) return;
  
  // 添加用户消息
  const userMsgDiv = document.createElement('div');
  userMsgDiv.style.cssText = 'display: flex; margin-bottom: 15px; justify-content: flex-end;';
  userMsgDiv.innerHTML = `
    <div style="background-color: #3498db; color: white; padding: 10px 15px; border-radius: 18px; border-bottom-right-radius: 4px; max-width: 70%;">
      <p style="margin: 0; font-size: 14px;">${message}</p>
    </div>
  `;
  chatMessages.appendChild(userMsgDiv);
  
  chatInput.value = '';
  chatMessages.scrollTop = chatMessages.scrollHeight;
  
  // AI智能回复
  setTimeout(function() {
    const aiResponse = getAIResponse(message);
    const csMsgDiv = document.createElement('div');
    csMsgDiv.style.cssText = 'display: flex; margin-bottom: 15px;';
    csMsgDiv.innerHTML = `
      <div style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; display: flex; align-items: center; justify-content: center; font-size: 14px; margin-right: 10px; flex-shrink: 0;">🤖</div>
      <div style="background-color: white; padding: 10px 15px; border-radius: 18px; border-bottom-left-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.1); max-width: 70%;">
        <p style="margin: 0; font-size: 14px; color: #333; line-height: 1.5;">${aiResponse}</p>
      </div>
    `;
    chatMessages.appendChild(csMsgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 800);
}

// 打开技术支持窗口
function openSupportWindow() {
  const supportWindow = document.getElementById('support-window');
  const overlay = document.getElementById('overlay');
  if (supportWindow) {
    supportWindow.style.display = 'flex';
    if (overlay) overlay.style.display = 'block';
  }
}

// 关闭技术支持窗口
function closeSupportWindow() {
  const supportWindow = document.getElementById('support-window');
  const overlay = document.getElementById('overlay');
  if (supportWindow) {
    supportWindow.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
  }
}

// 绑定技术支持窗口事件
function bindSupportWindowEvents() {
  const supportClose = document.getElementById('support-close');
  if (supportClose) {
    supportClose.onclick = function(e) {
      e.stopPropagation();
      closeSupportWindow();
    };
  }
}

// 打开产品咨询窗口
function openProductWindow() {
  const productWindow = document.getElementById('product-window');
  const overlay = document.getElementById('overlay');
  if (productWindow) {
    productWindow.style.display = 'flex';
    if (overlay) overlay.style.display = 'block';
  }
}

// 关闭产品咨询窗口
function closeProductWindow() {
  const productWindow = document.getElementById('product-window');
  const overlay = document.getElementById('overlay');
  if (productWindow) {
    productWindow.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
  }
}

// 绑定产品咨询窗口事件
function bindProductWindowEvents() {
  const productClose = document.getElementById('product-close');
  if (productClose) {
    productClose.onclick = function(e) {
      e.stopPropagation();
      closeProductWindow();
    };
  }
}

// 打开意见反馈窗口
function openFeedbackWindow() {
  const feedbackWindow = document.getElementById('feedback-window');
  const overlay = document.getElementById('overlay');
  if (feedbackWindow) {
    feedbackWindow.style.display = 'flex';
    if (overlay) overlay.style.display = 'block';
  }
}

// 关闭意见反馈窗口
function closeFeedbackWindow() {
  const feedbackWindow = document.getElementById('feedback-window');
  const overlay = document.getElementById('overlay');
  if (feedbackWindow) {
    feedbackWindow.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
  }
}

// 绑定意见反馈窗口事件
function bindFeedbackWindowEvents() {
  const feedbackClose = document.getElementById('feedback-close');
  const feedbackCancel = document.getElementById('feedback-cancel');
  const feedbackSubmit = document.getElementById('feedback-submit');
  
  if (feedbackClose) {
    feedbackClose.onclick = function(e) {
      e.stopPropagation();
      closeFeedbackWindow();
    };
  }
  
  if (feedbackCancel) {
    feedbackCancel.onclick = function(e) {
      e.stopPropagation();
      closeFeedbackWindow();
    };
  }
  
  if (feedbackSubmit) {
    feedbackSubmit.onclick = function(e) {
      e.stopPropagation();
      submitFeedback();
    };
  }
}

// 提交反馈
function submitFeedback() {
  const type = document.getElementById('feedback-type').value;
  const name = document.getElementById('feedback-name').value.trim();
  const phone = document.getElementById('feedback-phone').value.trim();
  const content = document.getElementById('feedback-content').value.trim();
  
  if (!name || !content) {
    alert('请填写姓名和反馈内容');
    return;
  }
  
  console.log('提交反馈:', { type, name, phone, content });
  alert('感谢您的反馈！我们会尽快处理。');
  
  // 清空表单
  document.getElementById('feedback-name').value = '';
  document.getElementById('feedback-phone').value = '';
  document.getElementById('feedback-content').value = '';
  
  closeFeedbackWindow();
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