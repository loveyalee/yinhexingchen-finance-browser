// 蜻蜓聊天器功能
function initChatFloat() {
  // 创建聊天器HTML
  const chatFloatHTML = `
    <!-- 悬浮聊天器 -->
    <div class="chat-float" style="display: block; position: fixed; bottom: 30px; right: 30px; z-index: 9999;">
      <button class="chat-toggle" onclick="toggleChatPanel()" style="display: block; width: 90px; height: 90px; background: none; border: none; font-size: 50px; cursor: pointer; transition: all 0.3s; display: flex; align-items: flex-start; justify-content: center; padding-top: 5px;">
        <style>
          @keyframes flap {
            0%, 100% {
              transform: scaleX(1) scaleY(1) rotate(0deg);
            }
            25% {
              transform: scaleX(1.2) scaleY(0.8) rotate(3deg);
            }
            50% {
              transform: scaleX(1) scaleY(1) rotate(0deg);
            }
            75% {
              transform: scaleX(0.8) scaleY(1.2) rotate(-3deg);
            }
          }
        </style>
        <span id="dqImg" style="filter: hue-rotate(90deg) brightness(1.5) saturate(0.8) contrast(0.7);">🦋</span>
        <div id="redDot" style="display:none;position:absolute;top:-2px;right:-2px;width:12px;height:12px;background:#f5222d;border-radius:50%"></div>
      </button>
      <div class="chat-panel" id="chatPanel" style="display: none; position: absolute; bottom: 70px; right: 0; width: 350px; background-color: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15); flex-direction: column; overflow: hidden;">
        <div class="chat-panel-header" style="background-color: #3498db; color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center;">
          <div class="chat-panel-title" style="font-weight: bold; font-size: 16px;">蜻蜓chat</div>
          <div class="chat-panel-close" onclick="closeChatPanel()" style="cursor: pointer; font-size: 18px;">&times;</div>
        </div>
        <div class="chat-panel-tabs" style="display: flex; border-bottom: 1px solid #e0e0e0;">
          <div class="chat-panel-tab active" data-tab="friends" style="flex: 1; padding: 12px; text-align: center; cursor: pointer; border-bottom: 2px solid #3498db; color: #3498db; font-weight: bold;">好友</div>
          <div class="chat-panel-tab" data-tab="groups" style="flex: 1; padding: 12px; text-align: center; cursor: pointer; border-bottom: 2px solid transparent;">群组</div>
        </div>
        <div class="chat-panel-content" style="flex: 1; padding: 15px; overflow-y: auto;">
          <!-- 好友列表 -->
          <div id="friends-tab" class="chat-panel-tab-content active" style="display: block;">
            <button class="add-friend-btn" onclick="openAddFriendModal()" style="width: 100%; padding: 10px; background-color: #f0f0f0; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; margin-bottom: 15px; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span>➕</span> 添加好友
            </button>
            <div class="chat-list" style="display: flex; flex-direction: column; gap: 10px;">
              <div class="chat-item" onclick="openChat('李会计')" style="display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 6px; cursor: pointer; transition: background-color 0.3s;">
                <div class="chat-item-avatar" style="width: 40px; height: 40px; border-radius: 50%; background-color: #3498db; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold;">李</div>
                <div class="chat-item-info" style="flex: 1;">
                  <div class="chat-item-name" style="font-weight: bold; font-size: 14px; color: #2c3e50;">李会计</div>
                  <div class="chat-item-preview" style="font-size: 12px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">增值税申报表已经提交</div>
                </div>
                <div class="chat-item-time" style="font-size: 12px; color: #999;">09:15</div>
                <div class="chat-item-badge" style="background-color: #e74c3c; color: white; font-size: 12px; padding: 2px 6px; border-radius: 10px; min-width: 20px; text-align: center;">2</div>
              </div>
              <div class="chat-item" onclick="openChat('王总监')" style="display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 6px; cursor: pointer; transition: background-color 0.3s;">
                <div class="chat-item-avatar" style="width: 40px; height: 40px; border-radius: 50%; background-color: #3498db; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold;">王</div>
                <div class="chat-item-info" style="flex: 1;">
                  <div class="chat-item-name" style="font-weight: bold; font-size: 14px; color: #2c3e50;">王总监</div>
                  <div class="chat-item-preview" style="font-size: 12px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">请尽快提供第一季度财务报表</div>
                </div>
                <div class="chat-item-time" style="font-size: 12px; color: #999;">昨天</div>
              </div>
              <div class="chat-item" onclick="openChat('张老师')" style="display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 6px; cursor: pointer; transition: background-color 0.3s;">
                <div class="chat-item-avatar" style="width: 40px; height: 40px; border-radius: 50%; background-color: #3498db; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold;">张</div>
                <div class="chat-item-info" style="flex: 1;">
                  <div class="chat-item-name" style="font-weight: bold; font-size: 14px; color: #2c3e50;">税务专家-张老师</div>
                  <div class="chat-item-preview" style="font-size: 12px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">关于 tax planning 的方案已发送</div>
                </div>
                <div class="chat-item-time" style="font-size: 12px; color: #999;">昨天</div>
                <div class="chat-item-badge" style="background-color: #e74c3c; color: white; font-size: 12px; padding: 2px 6px; border-radius: 10px; min-width: 20px; text-align: center;">1</div>
              </div>
            </div>
          </div>
          <!-- 群组列表 -->
          <div id="groups-tab" class="chat-panel-tab-content" style="display: none;">
            <div class="chat-list" style="display: flex; flex-direction: column; gap: 10px;">
              <div class="chat-item" onclick="openChat('财务团队群')" style="display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 6px; cursor: pointer; transition: background-color 0.3s;">
                <div class="chat-item-avatar" style="width: 40px; height: 40px; border-radius: 50%; background-color: #3498db; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold;">群</div>
                <div class="chat-item-info" style="flex: 1;">
                  <div class="chat-item-name" style="font-weight: bold; font-size: 14px; color: #2c3e50;">财务团队群</div>
                  <div class="chat-item-preview" style="font-size: 12px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">张经理: 请大家下午3点参加财务分析会议</div>
                </div>
                <div class="chat-item-time" style="font-size: 12px; color: #999;">10:30</div>
                <div class="chat-item-badge" style="background-color: #e74c3c; color: white; font-size: 12px; padding: 2px 6px; border-radius: 10px; min-width: 20px; text-align: center;">3</div>
              </div>
              <div class="chat-item" onclick="openChat('销售部群')" style="display: flex; align-items: center; gap: 12px; padding: 10px; border-radius: 6px; cursor: pointer; transition: background-color 0.3s;">
                <div class="chat-item-avatar" style="width: 40px; height: 40px; border-radius: 50%; background-color: #3498db; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold;">群</div>
                <div class="chat-item-info" style="flex: 1;">
                  <div class="chat-item-name" style="font-weight: bold; font-size: 14px; color: #2c3e50;">销售部群</div>
                  <div class="chat-item-preview" style="font-size: 12px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">赵经理: 本月销售额已达到目标的80%</div>
                </div>
                <div class="chat-item-time" style="font-size: 12px; color: #999;">2天前</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 聊天对话窗口 -->
    <div class="chat-panel" id="chatConversation" style="display: none; position: fixed; bottom: 70px; right: 380px; width: 350px; height: 400px; background-color: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15); flex-direction: column; overflow: hidden; z-index: 9998;">
      <div class="chat-panel-header" style="background-color: #3498db; color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center;">
        <div class="chat-panel-title" id="chatTitle" style="font-weight: bold; font-size: 16px;">李会计</div>
        <div class="chat-panel-close" onclick="closeChatConversation()" style="cursor: pointer; font-size: 18px;">&times;</div>
      </div>
      <div class="chat-conversation active" style="display: flex; flex-direction: column; height: 100%;">
        <div class="chat-messages" id="chatMessages" style="flex: 1; padding: 15px; overflow-y: auto; background-color: #f9f9f9;">
          <div class="message received" style="margin-bottom: 15px; display: flex; gap: 10px; justify-content: flex-start;">
            <div class="message-avatar" style="width: 36px; height: 36px; border-radius: 50%; background-color: #3498db; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">李</div>
            <div class="message-content" style="max-width: 70%; padding: 10px 15px; border-radius: 18px; word-wrap: break-word; background-color: white; border-bottom-left-radius: 4px;">
              <div>增值税申报表已经提交</div>
              <div class="message-time" style="font-size: 12px; color: #999; margin-top: 5px; text-align: right;">09:15</div>
            </div>
          </div>
          <div class="message sent" style="margin-bottom: 15px; display: flex; gap: 10px; justify-content: flex-end;">
            <div class="message-content" style="max-width: 70%; padding: 10px 15px; border-radius: 18px; word-wrap: break-word; background-color: #3498db; color: white; border-bottom-right-radius: 4px;">
              <div>好的，我已经收到了</div>
              <div class="message-time" style="font-size: 12px; color: rgba(255, 255, 255, 0.7); margin-top: 5px; text-align: right;">09:16</div>
            </div>
            <div class="message-avatar" style="width: 36px; height: 36px; border-radius: 50%; background-color: #3498db; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">我</div>
          </div>
          <div class="message received" style="margin-bottom: 15px; display: flex; gap: 10px; justify-content: flex-start;">
            <div class="message-avatar" style="width: 36px; height: 36px; border-radius: 50%; background-color: #3498db; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">李</div>
            <div class="message-content" style="max-width: 70%; padding: 10px 15px; border-radius: 18px; word-wrap: break-word; background-color: white; border-bottom-left-radius: 4px;">
              <div>需要我做什么其他事情吗？</div>
              <div class="message-time" style="font-size: 12px; color: #999; margin-top: 5px; text-align: right;">09:17</div>
            </div>
          </div>
        </div>
        <div class="chat-input" style="padding: 10px; border-top: 1px solid #e0e0e0; display: flex; gap: 10px; align-items: flex-end;">
          <textarea id="chatInput" placeholder="输入消息..." style="flex: 1; padding: 10px; border: 1px solid #e0e0e0; border-radius: 8px; resize: none; min-height: 40px; max-height: 100px; outline: none;"></textarea>
          <button onclick="sendMessage()" style="width: 40px; height: 40px; border: none; border-radius: 4px; background-color: #3498db; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px;">➤</button>
        </div>
      </div>
    </div>
    
    <!-- 添加好友模态框 -->
    <div class="modal" id="addFriendModal" style="display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); justify-content: center; align-items: center;">
      <div class="modal-content" style="background-color: white; border-radius: 8px; padding: 20px; width: 400px; max-width: 90%;">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <div class="modal-title" style="font-size: 18px; font-weight: bold; color: #2c3e50;">添加好友</div>
          <div class="modal-close" onclick="closeModal('addFriendModal')" style="cursor: pointer; font-size: 20px; color: #999;">&times;</div>
        </div>
        <div class="form-group" style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #2c3e50;">搜索用户</label>
          <input type="text" placeholder="输入手机号或用户名" style="width: 100%; padding: 10px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px;">
        </div>
        <div class="form-group" style="margin-bottom: 15px;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #2c3e50;">验证信息</label>
          <textarea placeholder="请输入验证信息" style="width: 100%; padding: 10px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px; min-height: 80px;"></textarea>
        </div>
        <div class="modal-actions" style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
          <button class="btn btn-secondary" onclick="closeModal('addFriendModal')" style="padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; background-color: #95a5a6; color: white;">取消</button>
          <button class="btn btn-primary" style="padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; background-color: #3498db; color: white;">发送请求</button>
        </div>
      </div>
    </div>
  `;
  
  // 将聊天器添加到页面底部
  document.body.insertAdjacentHTML('beforeend', chatFloatHTML);
  
  // 绑定标签切换事件
  document.addEventListener('DOMContentLoaded', function() {
    const chatTabs = document.querySelectorAll('.chat-panel-tab');
    chatTabs.forEach(tab => {
      tab.addEventListener('click', function() {
        // 移除所有标签的active类
        chatTabs.forEach(t => {
          t.style.borderBottomColor = 'transparent';
          t.style.color = '';
          t.style.fontWeight = '';
        });
        // 添加当前标签的active类
        this.style.borderBottomColor = '#3498db';
        this.style.color = '#3498db';
        this.style.fontWeight = 'bold';
        
        // 隐藏所有内容
        const tabContents = document.querySelectorAll('.chat-panel-tab-content');
        tabContents.forEach(content => content.style.display = 'none');
        // 显示对应内容
        const tabId = this.getAttribute('data-tab');
        document.getElementById(tabId + '-tab').style.display = 'block';
      });
    });
    
    // 绑定按Enter发送消息事件
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
      chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
    }
  });
}

// 切换聊天面板
function toggleChatPanel() {
  const chatPanel = document.getElementById('chatPanel');
  const chatToggle = document.querySelector('.chat-toggle');
  if (chatPanel.style.display === 'none') {
    chatPanel.style.display = 'flex';
    if (chatToggle) chatToggle.style.display = 'none';
  } else {
    chatPanel.style.display = 'none';
    if (chatToggle) chatToggle.style.display = 'flex';
  }
}

// 关闭聊天面板
function closeChatPanel() {
  const chatPanel = document.getElementById('chatPanel');
  const chatToggle = document.querySelector('.chat-toggle');
  chatPanel.style.display = 'none';
  if (chatToggle) chatToggle.style.display = 'flex';
}

// 关闭聊天对话窗口
function closeChatConversation() {
  const chatConversation = document.getElementById('chatConversation');
  chatConversation.style.display = 'none';
}

// 打开聊天对话
function openChat(title) {
  const chatConversation = document.getElementById('chatConversation');
  const chatTitle = document.getElementById('chatTitle');
  chatTitle.textContent = title;
  chatConversation.style.display = 'flex';
  // 播放蜻蜓的嗡嗡声，模拟好友来信息
  playDragonflySound();
}

// 生成蜻蜓的嗡嗡声
function playDragonflySound() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  // 设置振荡器类型和频率
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(440, audioContext.currentTime); // 440Hz 是 A4
  
  // 设置音量包络
  gainNode.gain.setValueAtTime(0, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.1);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);
  
  // 播放声音
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 1);
}

// 发送消息
function sendMessage() {
  const textarea = document.getElementById('chatInput');
  const message = textarea.value.trim();
  if (message) {
    const chatMessages = document.getElementById('chatMessages');
    const now = new Date();
    const time = now.getHours() + ':' + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
    
    const messageElement = document.createElement('div');
    messageElement.className = 'message sent';
    messageElement.style.marginBottom = '15px';
    messageElement.style.display = 'flex';
    messageElement.style.gap = '10px';
    messageElement.style.justifyContent = 'flex-end';
    messageElement.innerHTML = `
      <div class="message-content" style="max-width: 70%; padding: 10px 15px; border-radius: 18px; word-wrap: break-word; background-color: #3498db; color: white; border-bottom-right-radius: 4px;">
        <div>${message}</div>
        <div class="message-time" style="font-size: 12px; color: rgba(255, 255, 255, 0.7); margin-top: 5px; text-align: right;">${time}</div>
      </div>
      <div class="message-avatar" style="width: 36px; height: 36px; border-radius: 50%; background-color: #3498db; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">我</div>
    `;
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    textarea.value = '';
  }
}

// 打开模态框
function openModal(modalId) {
  document.getElementById(modalId).style.display = 'flex';
}

// 关闭模态框
function closeModal(modalId) {
  document.getElementById(modalId).style.display = 'none';
}

// 点击模态框外部关闭
window.onclick = function(event) {
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    if (event.target == modal) {
      modal.style.display = 'none';
    }
  });
}

// 初始化聊天器
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initChatFloat);
} else {
  initChatFloat();
}

// 蜻蜓图标状态切换
const dqImg = document.getElementById('dqImg');
const redDot = document.getElementById('redDot');

// 来消息：飞+红点 
function haveNewMsg(){
  dqImg.style.animation = "flap 1s ease-in-out infinite";
  redDot.style.display = "block";
}

// 无消息：静止+无红点 
function noNewMsg(){
  dqImg.style.animation = "none";
  redDot.style.display = "none";
}
