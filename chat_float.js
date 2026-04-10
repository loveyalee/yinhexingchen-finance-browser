// 蜻蜓聊天器功能

// 显示系统通知
function showSystemNotification(title, message) {
  // 创建通知元素
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    bottom: 100px;
    right: 20px;
    background-color: #2c3e50;
    color: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 10000;
    max-width: 300px;
    font-size: 14px;
    animation: slideIn 0.3s ease;
  `;
  notification.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 5px;">${title}</div>
    <div style="font-size: 13px; opacity: 0.9;">${message}</div>
  `;
  
  // 添加动画样式
  if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  document.body.appendChild(notification);
  
  // 3秒后自动消失
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// 系统托盘右键菜单
let trayMenuElement = null;

function showTrayMenu(event) {
  event.preventDefault();
  
  // 移除已存在的菜单
  if (trayMenuElement) {
    trayMenuElement.remove();
    trayMenuElement = null;
  }
  
  // 创建菜单
  trayMenuElement = document.createElement('div');
  trayMenuElement.id = 'tray-context-menu';
  trayMenuElement.style.cssText = `
    position: fixed;
    bottom: ${window.innerHeight - event.clientY + 10}px;
    right: ${window.innerWidth - event.clientX}px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 10001;
    min-width: 150px;
    overflow: hidden;
    animation: fadeIn 0.2s ease;
  `;
  
  trayMenuElement.innerHTML = `
    <div style="padding: 8px 0;">
      <div onclick="openChatFromTray()" style="padding: 10px 16px; cursor: pointer; font-size: 14px; color: #333; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#f0f0f0'" onmouseout="this.style.backgroundColor='transparent'">
        🦋 打开蜻蜓chat
      </div>
      <div style="height: 1px; background-color: #e0e0e0; margin: 4px 0;"></div>
      <div onclick="exitChatApp()" style="padding: 10px 16px; cursor: pointer; font-size: 14px; color: #e74c3c; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#fee'" onmouseout="this.style.backgroundColor='transparent'">
        ❌ 退出
      </div>
    </div>
  `;
  
  document.body.appendChild(trayMenuElement);
  
  // 点击其他地方关闭菜单
  setTimeout(() => {
    document.addEventListener('click', hideTrayMenu, { once: true });
  }, 100);
}

function hideTrayMenu() {
  if (trayMenuElement) {
    trayMenuElement.remove();
    trayMenuElement = null;
  }
}

function openChatFromTray() {
  hideTrayMenu();
  toggleChatPanel();
}

function exitChatApp() {
  hideTrayMenu();
  
  // 隐藏聊天面板和悬浮按钮
  const chatPanelWrapper = document.getElementById('chatPanelWrapper');
  const chatConversation = document.getElementById('chatConversation');
  const chatToggle = document.querySelector('.chat-toggle');
  
  if (chatPanelWrapper) chatPanelWrapper.style.display = 'none';
  if (chatConversation) chatConversation.style.display = 'none';
  if (chatToggle) chatToggle.style.display = 'none';
  
  // 显示退出通知
  showSystemNotification('蜻蜓chat', '已退出蜻蜓chat');
  
  // 3秒后恢复悬浮按钮（模拟重新启动）
  setTimeout(() => {
    if (chatToggle) chatToggle.style.display = 'flex';
    showSystemNotification('蜻蜓chat', '蜻蜓chat已重新启动');
  }, 3000);
}

// 系统托盘悬停预览
let trayPreviewElement = null;
let previewHideTimeout = null;

function showTrayPreview() {
  // 清除隐藏定时器
  if (previewHideTimeout) {
    clearTimeout(previewHideTimeout);
    previewHideTimeout = null;
  }
  
  // 如果预览已存在，不重复创建
  if (trayPreviewElement) return;
  
  // 获取最近的聊天记录
  const recentMessages = getRecentMessages();
  
  // 创建预览元素
  trayPreviewElement = document.createElement('div');
  trayPreviewElement.id = 'tray-preview';
  trayPreviewElement.style.cssText = `
    position: fixed;
    bottom: 110px;
    right: 20px;
    width: 300px;
    background-color: white;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    z-index: 10000;
    overflow: hidden;
    animation: slideUp 0.3s ease;
  `;
  
  // 添加动画样式
  if (!document.getElementById('preview-animations')) {
    const style = document.createElement('style');
    style.id = 'preview-animations';
    style.textContent = `
      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      @keyframes slideDown {
        from { transform: translateY(0); opacity: 1; }
        to { transform: translateY(20px); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  // 构建预览内容
  let previewHTML = `
    <div style="background: linear-gradient(135deg, #3498db, #2980b9); color: white; padding: 12px 16px; display: flex; align-items: center; gap: 10px;">
      <span style="font-size: 20px;">🦋</span>
      <div>
        <div style="font-weight: bold; font-size: 14px;">蜻蜓chat</div>
        <div style="font-size: 12px; opacity: 0.9;">最近消息</div>
      </div>
    </div>
    <div style="max-height: 250px; overflow-y: auto;">
  `;
  
  if (recentMessages.length === 0) {
    previewHTML += `
      <div style="padding: 30px; text-align: center; color: #999;">
        <div style="font-size: 32px; margin-bottom: 8px;">💬</div>
        <div style="font-size: 13px;">暂无新消息</div>
      </div>
    `;
  } else {
    recentMessages.forEach(msg => {
      previewHTML += `
        <div style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; cursor: pointer; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#f8f9fa'" onmouseout="this.style.backgroundColor='transparent'" onclick="openChatFromPreview('${msg.sender}')">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <div style="font-weight: bold; font-size: 13px; color: #2c3e50;">${msg.sender}</div>
            <div style="font-size: 11px; color: #999;">${msg.time}</div>
          </div>
          <div style="font-size: 12px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${msg.content}</div>
        </div>
      `;
    });
  }
  
  previewHTML += `
    </div>
    <div style="padding: 10px 16px; background-color: #f8f9fa; border-top: 1px solid #e0e0e0; text-align: center;">
      <span style="font-size: 12px; color: #3498db; cursor: pointer;" onclick="openChatFromPreview()">查看全部消息 →</span>
    </div>
  `;
  
  trayPreviewElement.innerHTML = previewHTML;
  document.body.appendChild(trayPreviewElement);
}

function hideTrayPreview() {
  // 延迟隐藏，避免鼠标移动到预览窗口时消失
  previewHideTimeout = setTimeout(() => {
    if (trayPreviewElement) {
      trayPreviewElement.style.animation = 'slideDown 0.3s ease';
      setTimeout(() => {
        if (trayPreviewElement) {
          trayPreviewElement.remove();
          trayPreviewElement = null;
        }
      }, 300);
    }
  }, 200);
}

// 获取最近的消息（模拟数据）
function getRecentMessages() {
  // 从localStorage获取消息记录，如果没有则返回模拟数据
  const savedMessages = localStorage.getItem('chatMessages');
  if (savedMessages) {
    return JSON.parse(savedMessages).slice(-5).reverse();
  }
  
  // 返回模拟的最近消息
  return [
    { sender: '李会计', content: '好的，明天见！', time: '10:30', unread: true },
    { sender: '王经理', content: '财务报表已经发给你了', time: '09:45', unread: true },
    { sender: '张总监', content: '收到，谢谢！', time: '昨天', unread: false },
    { sender: '财务团队群', content: '赵会计: 下午开会讨论预算', time: '昨天', unread: false }
  ];
}

// 从预览窗口打开聊天
function openChatFromPreview(sender) {
  hideTrayPreview();
  if (sender) {
    openChat(sender);
  } else {
    toggleChatPanel();
  }
}

function initChatFloat() {
  // 创建聊天器HTML
  const chatFloatHTML = `
    <!-- 悬浮聊天器 -->
    <div class="chat-float" style="display: block; position: fixed; bottom: 30px; right: 30px; z-index: 9999;">
      <button class="chat-toggle" onclick="toggleChatPanel()" oncontextmenu="showTrayMenu(event)" onmouseenter="showTrayPreview()" onmouseleave="hideTrayPreview()" style="display: block; width: 90px; height: 90px; background: none; border: none; font-size: 50px; cursor: pointer; transition: all 0.3s; display: flex; align-items: flex-start; justify-content: center; padding-top: 5px;">
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
          /* 聊天面板resize手柄样式 */
          .resize-edge {
            background-color: transparent;
            transition: background-color 0.2s;
          }
          .resize-edge:hover {
            background-color: rgba(52, 152, 219, 0.3);
          }
          .resize-corner {
            background-color: transparent;
            transition: background-color 0.2s;
          }
          .resize-corner:hover {
            background-color: rgba(52, 152, 219, 0.5);
          }
          .resize-se {
            background: linear-gradient(135deg, transparent 50%, #3498db 50%) !important;
          }
          .resize-se:hover {
            background: linear-gradient(135deg, transparent 40%, #2980b9 40%) !important;
          }
        </style>
        <span id="dqImg" style="filter: hue-rotate(90deg) brightness(1.5) saturate(0.8) contrast(0.7);">🦋</span>
        <div id="redDot" style="display:none;position:absolute;top:-2px;right:-2px;width:12px;height:12px;background:#f5222d;border-radius:50%"></div>
      </button>
      <div class="chat-panel-wrapper" id="chatPanelWrapper" style="display: none; position: absolute; bottom: 70px; right: 0; width: 400px; height: 733px; overflow: visible; min-width: 300px; min-height: 400px; max-width: 800px; max-height: 900px; z-index: 9999;">
        <div class="chat-panel" id="chatPanel" style="width: 100%; height: 100%; background-color: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15); display: flex; flex-direction: column; overflow: hidden; position: relative;">
          <!-- 上边框调整大小 -->
          <div class="resize-edge resize-top" data-direction="top" style="position: absolute; top: -5px; left: 10px; right: 10px; height: 10px; cursor: ns-resize; z-index: 101;"></div>
          <!-- 下边框调整大小 -->
          <div class="resize-edge resize-bottom" data-direction="bottom" style="position: absolute; bottom: -5px; left: 10px; right: 10px; height: 10px; cursor: ns-resize; z-index: 101;"></div>
          <!-- 左边框调整大小 -->
          <div class="resize-edge resize-left" data-direction="left" style="position: absolute; left: -5px; top: 10px; bottom: 10px; width: 10px; cursor: ew-resize; z-index: 101;"></div>
          <!-- 右边框调整大小 -->
          <div class="resize-edge resize-right" data-direction="right" style="position: absolute; right: -5px; top: 10px; bottom: 10px; width: 10px; cursor: ew-resize; z-index: 101;"></div>
          <!-- 四个角调整大小 -->
          <div class="resize-corner resize-nw" data-direction="nw" style="position: absolute; top: -5px; left: -5px; width: 15px; height: 15px; cursor: nwse-resize; z-index: 102;"></div>
          <div class="resize-corner resize-ne" data-direction="ne" style="position: absolute; top: -5px; right: -5px; width: 15px; height: 15px; cursor: nesw-resize; z-index: 102;"></div>
          <div class="resize-corner resize-sw" data-direction="sw" style="position: absolute; bottom: -5px; left: -5px; width: 15px; height: 15px; cursor: nesw-resize; z-index: 102;"></div>
          <div class="resize-corner resize-se" data-direction="se" style="position: absolute; bottom: -5px; right: -5px; width: 15px; height: 15px; cursor: nwse-resize; z-index: 102; background: linear-gradient(135deg, transparent 50%, #3498db 50%); border-radius: 0 0 8px 0;"></div>
          <div class="chat-panel-header" style="background-color: #3498db; color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
            <div class="chat-panel-title" style="font-weight: bold; font-size: 16px;">蜻蜓chat</div>
            <div style="display: flex; gap: 15px; align-items: center;">
              <div class="chat-panel-minimize" onclick="minimizeChatPanel()" style="cursor: pointer; font-size: 16px;" title="最小化">−</div>
              <div class="chat-panel-close" onclick="closeChatPanel()" style="cursor: pointer; font-size: 18px;" title="关闭">&times;</div>
            </div>
          </div>
          <div class="chat-panel-tabs" style="display: flex; border-bottom: 1px solid #e0e0e0; flex-shrink: 0;">
            <div class="chat-panel-tab active" data-tab="friends" style="flex: 1; padding: 12px; text-align: center; cursor: pointer; border-bottom: 2px solid #3498db; color: #3498db; font-weight: bold;">好友</div>
            <div class="chat-panel-tab" data-tab="groups" style="flex: 1; padding: 12px; text-align: center; cursor: pointer; border-bottom: 2px solid transparent;">群组</div>
            <div class="chat-panel-tab" data-tab="plaza" style="flex: 1; padding: 12px; text-align: center; cursor: pointer; border-bottom: 2px solid transparent;">广场</div>
            <div class="chat-panel-tab" data-tab="circles" style="flex: 1; padding: 12px; text-align: center; cursor: pointer; border-bottom: 2px solid transparent;">圈子</div>
          </div>
          <div class="chat-panel-content" style="flex: 1; padding: 15px; overflow-y: auto; min-height: 0;">
          <!-- 好友列表 -->
          <div id="friends-tab" class="chat-panel-tab-content active" style="display: block;">
            <button class="add-friend-btn" onclick="openAddFriendModal()" style="width: 100%; padding: 10px; background-color: #f0f0f0; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; margin-bottom: 15px; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span>➕</span> 添加好友
            </button>
            
            <!-- 推荐好友区域 -->
            <div class="recommended-friends" style="margin-bottom: 20px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div style="font-weight: bold; font-size: 14px; color: #2c3e50;">🤝 推荐好友</div>
                <div style="font-size: 12px; color: #3498db; cursor: pointer;" onclick="refreshRecommendedFriends()">🔄 换一批</div>
              </div>
              <div class="recommended-friends-list" id="recommended-friends-list" style="display: flex; flex-direction: column; gap: 10px;">
                <!-- 推荐好友将在这里显示 -->
              </div>
            </div>
            
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
          
          <!-- 聊天广场 -->
          <div id="plaza-tab" class="chat-panel-tab-content" style="display: none;">
            <!-- 广场选择 -->
            <div id="plaza-selector" style="margin-bottom: 15px;">
              <div style="font-weight: bold; color: #2c3e50; margin-bottom: 10px; font-size: 14px;">🏛️ 选择聊天广场</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="plaza-option" data-plaza="accounting" onclick="selectPlaza('accounting')" style="padding: 12px; background-color: #e3f2fd; border: 2px solid transparent; border-radius: 8px; cursor: pointer; text-align: center; transition: all 0.3s;">
                  <div style="font-size: 24px; margin-bottom: 5px;">📊</div>
                  <div style="font-weight: bold; font-size: 13px; color: #1976d2;">会计交流</div>
                  <div style="font-size: 11px; color: #666; margin-top: 3px;">会计实务/做账技巧</div>
                </div>
                <div class="plaza-option" data-plaza="manager" onclick="selectPlaza('manager')" style="padding: 12px; background-color: #f3e5f5; border: 2px solid transparent; border-radius: 8px; cursor: pointer; text-align: center; transition: all 0.3s;">
                  <div style="font-size: 24px; margin-bottom: 5px;">💼</div>
                  <div style="font-weight: bold; font-size: 13px; color: #7b1fa2;">财务经理人</div>
                  <div style="font-size: 11px; color: #666; margin-top: 3px;">管理/决策/战略</div>
                </div>
                <div class="plaza-option" data-plaza="certificate" onclick="selectPlaza('certificate')" style="padding: 12px; background-color: #fff3e0; border: 2px solid transparent; border-radius: 8px; cursor: pointer; text-align: center; transition: all 0.3s;">
                  <div style="font-size: 24px; margin-bottom: 5px;">📜</div>
                  <div style="font-weight: bold; font-size: 13px; color: #e65100;">考证专区</div>
                  <div style="font-size: 11px; color: #666; margin-top: 3px;">CPA/中级/税务师</div>
                </div>
                <div class="plaza-option" data-plaza="jobs" onclick="selectPlaza('jobs')" style="padding: 12px; background-color: #e8f5e9; border: 2px solid transparent; border-radius: 8px; cursor: pointer; text-align: center; transition: all 0.3s;">
                  <div style="font-size: 24px; margin-bottom: 5px;">🎯</div>
                  <div style="font-weight: bold; font-size: 13px; color: #388e3c;">求职招聘</div>
                  <div style="font-size: 11px; color: #666; margin-top: 3px;">招聘/求职/内推</div>
                </div>
                <div class="plaza-option" data-plaza="life" onclick="selectPlaza('life')" style="padding: 12px; background-color: #fce4ec; border: 2px solid transparent; border-radius: 8px; cursor: pointer; text-align: center; transition: all 0.3s; grid-column: 1 / -1;">
                  <div style="font-size: 24px; margin-bottom: 5px;">☕</div>
                  <div style="font-weight: bold; font-size: 13px; color: #c2185b;">生活广场</div>
                  <div style="font-size: 11px; color: #666; margin-top: 3px;">闲聊/吐槽/兴趣爱好</div>
                </div>
              </div>
            </div>
            
            <!-- 广场聊天区域 -->
            <div id="plaza-chat-container" style="display: none;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding: 10px; background-color: #f8f9fa; border-radius: 6px;">
                <div>
                  <span id="current-plaza-name" style="font-weight: bold; color: #2c3e50;">💬 广场</span>
                  <span id="plaza-user-count" style="font-size: 12px; color: #666; margin-left: 10px;">当前在线: 0/500人</span>
                </div>
                <div style="display: flex; gap: 10px;">
                  <button id="plaza-join-btn" onclick="togglePlazaJoin()" style="padding: 6px 12px; background-color: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">进入广场</button>
                  <button id="plaza-mute-btn" onclick="togglePlazaMute()" style="padding: 6px 12px; background-color: #95a5a6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">免打扰: 关</button>
                  <button onclick="backToPlazaSelector()" style="padding: 6px 12px; background-color: #7f8c8d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">返回</button>
                </div>
              </div>
              
              <div id="plaza-not-joined" style="text-align: center; padding: 30px 20px; color: #666;">
                <div style="font-size: 48px; margin-bottom: 15px;">🏛️</div>
                <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px;">欢迎进入<span id="plaza-welcome-name">广场</span></div>
                <div style="font-size: 14px; margin-bottom: 20px;">与500位财务同行实时交流</div>
                <button onclick="joinPlaza()" style="padding: 10px 30px; background-color: #3498db; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">立即进入</button>
              </div>
              
              <div id="plaza-chat-area" style="display: none; height: 220px; overflow-y: auto; border: 1px solid #e0e0e0; border-radius: 6px; padding: 10px; background-color: #f8f9fa;">
                <!-- 广场消息将在这里显示 -->
              </div>
              
              <div id="plaza-input-area" style="display: none; margin-top: 10px;">
                <div style="display: flex; gap: 10px;">
                  <input type="text" id="plaza-message-input" placeholder="输入消息..." style="flex: 1; padding: 10px; border: 1px solid #e0e0e0; border-radius: 4px; outline: none;" onkeypress="if(event.key==='Enter')sendPlazaMessage()">
                  <button onclick="sendPlazaMessage()" style="padding: 10px 20px; background-color: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">发送</button>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 圈子功能 -->
          <div id="circles-tab" class="chat-panel-tab-content" style="display: none;">
            <div id="circles-selector" style="margin-bottom: 15px;">
              <div style="font-weight: bold; color: #2c3e50; margin-bottom: 10px; font-size: 14px;">🎯 选择圈子类型</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div class="circle-option" onclick="selectCircleType('industry')" style="padding: 15px; background-color: #e3f2fd; border: 2px solid transparent; border-radius: 8px; cursor: pointer; text-align: center; transition: all 0.3s;">
                  <div style="font-size: 28px; margin-bottom: 5px;">🏭</div>
                  <div style="font-weight: bold; font-size: 13px; color: #1976d2;">行业圈</div>
                  <div style="font-size: 11px; color: #666; margin-top: 3px;">按行业分类交流</div>
                </div>
                <div class="circle-option" onclick="selectCircleType('city')" style="padding: 15px; background-color: #e8f5e9; border: 2px solid transparent; border-radius: 8px; cursor: pointer; text-align: center; transition: all 0.3s;">
                  <div style="font-size: 28px; margin-bottom: 5px;">🏙️</div>
                  <div style="font-weight: bold; font-size: 13px; color: #388e3c;">同城圈</div>
                  <div style="font-size: 11px; color: #666; margin-top: 3px;">按城市地区交流</div>
                </div>
              </div>
            </div>
            
            <!-- 行业圈选择 -->
            <div id="industry-circles" style="display: none;">
              <div style="font-weight: bold; color: #2c3e50; margin-bottom: 10px; font-size: 14px;">🏭 选择行业</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px;">
                <div class="industry-item" onclick="joinIndustryCircle('制造业')" style="padding: 10px; background-color: #f5f5f5; border-radius: 6px; cursor: pointer; text-align: center; font-size: 13px; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#e3f2fd'" onmouseout="this.style.backgroundColor='#f5f5f5'">🏭 制造业</div>
                <div class="industry-item" onclick="joinIndustryCircle('金融业')" style="padding: 10px; background-color: #f5f5f5; border-radius: 6px; cursor: pointer; text-align: center; font-size: 13px; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#e3f2fd'" onmouseout="this.style.backgroundColor='#f5f5f5'">🏦 金融业</div>
                <div class="industry-item" onclick="joinIndustryCircle('房地产')" style="padding: 10px; background-color: #f5f5f5; border-radius: 6px; cursor: pointer; text-align: center; font-size: 13px; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#e3f2fd'" onmouseout="this.style.backgroundColor='#f5f5f5'">🏢 房地产</div>
                <div class="industry-item" onclick="joinIndustryCircle('互联网')" style="padding: 10px; background-color: #f5f5f5; border-radius: 6px; cursor: pointer; text-align: center; font-size: 13px; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#e3f2fd'" onmouseout="this.style.backgroundColor='#f5f5f5'">💻 互联网</div>
                <div class="industry-item" onclick="joinIndustryCircle('零售业')" style="padding: 10px; background-color: #f5f5f5; border-radius: 6px; cursor: pointer; text-align: center; font-size: 13px; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#e3f2fd'" onmouseout="this.style.backgroundColor='#f5f5f5'">🛒 零售业</div>
                <div class="industry-item" onclick="joinIndustryCircle('服务业')" style="padding: 10px; background-color: #f5f5f5; border-radius: 6px; cursor: pointer; text-align: center; font-size: 13px; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#e3f2fd'" onmouseout="this.style.backgroundColor='#f5f5f5'">🎯 服务业</div>
                <div class="industry-item" onclick="joinIndustryCircle('医疗健康')" style="padding: 10px; background-color: #f5f5f5; border-radius: 6px; cursor: pointer; text-align: center; font-size: 13px; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#e3f2fd'" onmouseout="this.style.backgroundColor='#f5f5f5'">🏥 医疗健康</div>
                <div class="industry-item" onclick="joinIndustryCircle('教育培训')" style="padding: 10px; background-color: #f5f5f5; border-radius: 6px; cursor: pointer; text-align: center; font-size: 13px; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#e3f2fd'" onmouseout="this.style.backgroundColor='#f5f5f5'">📚 教育培训</div>
                <div class="industry-item" onclick="joinIndustryCircle('再生资源')" style="padding: 10px; background-color: #f5f5f5; border-radius: 6px; cursor: pointer; text-align: center; font-size: 13px; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#e3f2fd'" onmouseout="this.style.backgroundColor='#f5f5f5'">♻️ 再生资源</div>
                <div class="industry-item" onclick="joinIndustryCircle('电商')" style="padding: 10px; background-color: #f5f5f5; border-radius: 6px; cursor: pointer; text-align: center; font-size: 13px; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#e3f2fd'" onmouseout="this.style.backgroundColor='#f5f5f5'">🛍️ 电商</div>
                <div class="industry-item" onclick="joinIndustryCircle('跨境电商')" style="padding: 10px; background-color: #f5f5f5; border-radius: 6px; cursor: pointer; text-align: center; font-size: 13px; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#e3f2fd'" onmouseout="this.style.backgroundColor='#f5f5f5'">🌍 跨境电商</div>
              </div>
              <button onclick="backToCircleSelector()" style="padding: 8px 16px; background-color: #95a5a6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">← 返回</button>
            </div>
            
            <!-- 同城圈选择 -->
            <div id="city-circles" style="display: none;">
              <div style="font-weight: bold; color: #2c3e50; margin-bottom: 10px; font-size: 14px;">🏙️ 选择城市</div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 15px;">
                <div class="city-item" onclick="joinCityCircle('北京')" style="padding: 10px; background-color: #f5f5f5; border-radius: 6px; cursor: pointer; text-align: center; font-size: 13px; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#e8f5e9'" onmouseout="this.style.backgroundColor='#f5f5f5'">🏛️ 北京</div>
                <div class="city-item" onclick="joinCityCircle('上海')" style="padding: 10px; background-color: #f5f5f5; border-radius: 6px; cursor: pointer; text-align: center; font-size: 13px; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#e8f5e9'" onmouseout="this.style.backgroundColor='#f5f5f5'">🌃 上海</div>
                <div class="city-item" onclick="joinCityCircle('广州')" style="padding: 10px; background-color: #f5f5f5; border-radius: 6px; cursor: pointer; text-align: center; font-size: 13px; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#e8f5e9'" onmouseout="this.style.backgroundColor='#f5f5f5'">🌴 广州</div>
                <div class="city-item" onclick="joinCityCircle('深圳')" style="padding: 10px; background-color: #f5f5f5; border-radius: 6px; cursor: pointer; text-align: center; font-size: 13px; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#e8f5e9'" onmouseout="this.style.backgroundColor='#f5f5f5'">🏙️ 深圳</div>
                <div class="city-item" onclick="joinCityCircle('杭州')" style="padding: 10px; background-color: #f5f5f5; border-radius: 6px; cursor: pointer; text-align: center; font-size: 13px; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#e8f5e9'" onmouseout="this.style.backgroundColor='#f5f5f5'">🌸 杭州</div>
                <div class="city-item" onclick="joinCityCircle('成都')" style="padding: 10px; background-color: #f5f5f5; border-radius: 6px; cursor: pointer; text-align: center; font-size: 13px; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#e8f5e9'" onmouseout="this.style.backgroundColor='#f5f5f5'">🐼 成都</div>
                <div class="city-item" onclick="joinCityCircle('武汉')" style="padding: 10px; background-color: #f5f5f5; border-radius: 6px; cursor: pointer; text-align: center; font-size: 13px; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#e8f5e9'" onmouseout="this.style.backgroundColor='#f5f5f5'">🌉 武汉</div>
                <div class="city-item" onclick="joinCityCircle('西安')" style="padding: 10px; background-color: #f5f5f5; border-radius: 6px; cursor: pointer; text-align: center; font-size: 13px; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#e8f5e9'" onmouseout="this.style.backgroundColor='#f5f5f5'">🏺 西安</div>
              </div>
              <button onclick="backToCircleSelector()" style="padding: 8px 16px; background-color: #95a5a6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">← 返回</button>
            </div>
            
            <!-- 圈子聊天区域 -->
            <div id="circle-chat-container" style="display: none;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding: 10px; background-color: #f8f9fa; border-radius: 6px;">
                <div>
                  <span id="current-circle-name" style="font-weight: bold; color: #2c3e50;">🎯 圈子</span>
                  <span id="circle-member-count" style="font-size: 12px; color: #666; margin-left: 10px;">成员: 0人</span>
                </div>
                <div style="display: flex; gap: 10px;">
                  <button onclick="leaveCircle()" style="padding: 6px 12px; background-color: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">退出圈子</button>
                  <button onclick="backToCircleSelector()" style="padding: 6px 12px; background-color: #7f8c8d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">返回</button>
                </div>
              </div>
              
              <div id="circle-chat-area" style="height: 220px; overflow-y: auto; border: 1px solid #e0e0e0; border-radius: 6px; padding: 10px; background-color: #f8f9fa;">
                <!-- 圈子消息将在这里显示 -->
              </div>
              
              <div style="margin-top: 10px;">
                <div style="display: flex; gap: 10px;">
                  <input type="text" id="circle-message-input" placeholder="输入消息..." style="flex: 1; padding: 10px; border: 1px solid #e0e0e0; border-radius: 4px; outline: none;" onkeypress="if(event.key==='Enter')sendCircleMessage()">
                  <button onclick="sendCircleMessage()" style="padding: 10px 20px; background-color: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">发送</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 聊天对话窗口 -->
    <div class="chat-panel" id="chatConversation" style="display: none; position: fixed; bottom: 70px; right: 430px; width: 450px; height: 733px; background-color: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15); flex-direction: column; overflow: auto; z-index: 9998; resize: both; min-width: 300px; min-height: 350px; max-width: 800px; max-height: 900px;">
      <div class="chat-panel-header" style="background-color: #3498db; color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center;">
        <div class="chat-panel-title" id="chatTitle" style="font-weight: bold; font-size: 16px;">李会计</div>
        <div style="display: flex; gap: 15px; align-items: center;">
          <div class="chat-panel-minimize" onclick="minimizeChatConversation()" style="cursor: pointer; font-size: 16px;" title="最小化">−</div>
          <div class="chat-panel-close" onclick="closeChatConversation()" style="cursor: pointer; font-size: 18px;" title="关闭">&times;</div>
        </div>
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
        <div class="chat-input" style="padding: 10px; border-top: 1px solid #e0e0e0; display: flex; gap: 10px; align-items: flex-end; flex-shrink: 0;">
          <textarea id="chatInput" placeholder="输入消息..." style="flex: 1; padding: 10px; border: 1px solid #e0e0e0; border-radius: 8px; resize: none; min-height: 40px; max-height: 100px; outline: none;"></textarea>
          <button onclick="sendMessage()" style="width: 40px; height: 40px; border: none; border-radius: 4px; background-color: #3498db; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px;">➤</button>
        </div>
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
  
  // 使用事件委托绑定标签切换事件
  bindTabEvents();
  
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
  
  // 初始化推荐好友
  initRecommendedFriends();
}

// 绑定标签页切换事件（使用事件委托）
function bindTabEvents() {
  const chatPanel = document.getElementById('chatPanel');
  if (!chatPanel) return;
  
  // 使用事件委托，在父元素上绑定点击事件
  const tabsContainer = chatPanel.querySelector('.chat-panel-tabs');
  if (!tabsContainer) return;
  
  tabsContainer.addEventListener('click', function(e) {
    // 找到被点击的标签
    const tab = e.target.closest('.chat-panel-tab');
    if (!tab) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const tabName = tab.getAttribute('data-tab');
    console.log('点击标签:', tabName);
    
    // 移除所有标签的active样式
    const allTabs = tabsContainer.querySelectorAll('.chat-panel-tab');
    allTabs.forEach(function(t) {
      t.style.borderBottomColor = 'transparent';
      t.style.color = '';
      t.style.fontWeight = '';
    });
    
    // 添加当前标签的active样式
    tab.style.borderBottomColor = '#3498db';
    tab.style.color = '#3498db';
    tab.style.fontWeight = 'bold';
    
    // 隐藏所有内容
    const tabContents = chatPanel.querySelectorAll('.chat-panel-tab-content');
    tabContents.forEach(function(content) {
      content.style.display = 'none';
    });
    
    // 显示对应内容
    const targetContent = document.getElementById(tabName + '-tab');
    if (targetContent) {
      targetContent.style.display = 'block';
      console.log('显示内容:', tabName + '-tab');
    } else {
      console.error('找不到内容元素:', tabName + '-tab');
    }
  });
}

// 切换聊天面板
function toggleChatPanel() {
  const chatPanelWrapper = document.getElementById('chatPanelWrapper');
  const chatToggle = document.querySelector('.chat-toggle');
  if (chatPanelWrapper.style.display === 'none') {
    chatPanelWrapper.style.display = 'block';
    if (chatToggle) chatToggle.style.display = 'none';
  } else {
    chatPanelWrapper.style.display = 'none';
    if (chatToggle) chatToggle.style.display = 'flex';
  }
}

// 最小化聊天面板
function minimizeChatPanel() {
  const chatPanelWrapper = document.getElementById('chatPanelWrapper');
  const chatToggle = document.querySelector('.chat-toggle');
  chatPanelWrapper.style.display = 'none';
  if (chatToggle) chatToggle.style.display = 'flex';
}

// 关闭聊天面板（最小化到系统托盘/右下角）
function closeChatPanel() {
  const chatPanelWrapper = document.getElementById('chatPanelWrapper');
  const chatToggle = document.querySelector('.chat-toggle');
  
  // 隐藏面板
  chatPanelWrapper.style.display = 'none';
  
  // 显示悬浮按钮（在右下角）
  if (chatToggle) {
    chatToggle.style.display = 'flex';
    chatToggle.style.position = 'fixed';
    chatToggle.style.bottom = '20px';
    chatToggle.style.right = '20px';
  }
  
  // 显示提示
  showSystemNotification('蜻蜓chat', '聊天面板已最小化到系统托盘，点击右下角图标可重新打开');
}

// 最小化聊天对话窗口
function minimizeChatConversation() {
  const chatConversation = document.getElementById('chatConversation');
  chatConversation.style.display = 'none';
}

// 关闭聊天对话窗口（最小化到系统托盘/右下角）
function closeChatConversation() {
  const chatConversation = document.getElementById('chatConversation');
  const chatToggle = document.querySelector('.chat-toggle');
  
  // 隐藏对话窗口
  chatConversation.style.display = 'none';
  
  // 显示悬浮按钮（在右下角）
  if (chatToggle) {
    chatToggle.style.display = 'flex';
    chatToggle.style.position = 'fixed';
    chatToggle.style.bottom = '20px';
    chatToggle.style.right = '20px';
  }
  
  // 显示提示
  showSystemNotification('蜻蜓chat', '聊天窗口已最小化到系统托盘，点击右下角图标可重新打开');
}

// 推荐好友数据
const recommendedFriendsData = [
  { id: 1, name: '赵财务', avatar: '赵', company: '科技公司', position: '财务经理', mutualFriends: 5, tags: ['CPA', '税务专家'], score: 95 },
  { id: 2, name: '钱会计', avatar: '钱', company: '制造企业', position: '会计主管', mutualFriends: 3, tags: ['中级会计', '成本核算'], score: 90 },
  { id: 3, name: '孙出纳', avatar: '孙', company: '贸易公司', position: '出纳', mutualFriends: 2, tags: ['初级会计', '银行对接'], score: 85 },
  { id: 4, name: '李财务', avatar: '李', company: '互联网公司', position: '财务总监', mutualFriends: 8, tags: ['CFO', '财务管理'], score: 98 },
  { id: 5, name: '周税务', avatar: '周', company: '税务师事务所', position: '税务顾问', mutualFriends: 4, tags: ['税务师', '筹划专家'], score: 92 },
  { id: 6, name: '吴审计', avatar: '吴', company: '会计师事务所', position: '审计经理', mutualFriends: 6, tags: ['CPA', '审计专家'], score: 96 },
  { id: 7, name: '郑财务', avatar: '郑', company: '房地产公司', position: '财务经理', mutualFriends: 3, tags: ['房地产财务', '融资专家'], score: 88 },
  { id: 8, name: '王会计', avatar: '王', company: '零售企业', position: '会计', mutualFriends: 1, tags: ['零售会计', '库存管理'], score: 82 }
];

// 初始化推荐好友
function initRecommendedFriends() {
  renderRecommendedFriends();
}

// 渲染推荐好友
function renderRecommendedFriends() {
  const recommendedFriendsList = document.getElementById('recommended-friends-list');
  if (!recommendedFriendsList) return;
  
  // 随机选择4个推荐好友
  const shuffled = [...recommendedFriendsData].sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 4);
  
  let html = '';
  selected.forEach(friend => {
    html += `
      <div class="recommended-friend-item" style="display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #f8f9fa;">
        <div class="recommended-friend-avatar" style="width: 48px; height: 48px; border-radius: 50%; background-color: #3498db; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px;">${friend.avatar}</div>
        <div class="recommended-friend-info" style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <div style="font-weight: bold; font-size: 14px; color: #2c3e50;">${friend.name}</div>
            <div style="font-size: 12px; color: #666; background-color: #e3f2fd; padding: 2px 8px; border-radius: 10px;">${friend.mutualFriends} 个共同好友</div>
          </div>
          <div style="font-size: 12px; color: #666; margin-bottom: 4px;">${friend.company} · ${friend.position}</div>
          <div style="display: flex; gap: 6px;">
            ${friend.tags.map(tag => `<span style="font-size: 11px; color: #3498db; background-color: #e3f2fd; padding: 2px 6px; border-radius: 8px;">${tag}</span>`).join('')}
          </div>
        </div>
        <button onclick="sendFriendRequest(${friend.id}, '${friend.name}')" style="padding: 6px 16px; background-color: #3498db; color: white; border: none; border-radius: 20px; cursor: pointer; font-size: 12px; font-weight: 500;">加好友</button>
      </div>
    `;
  });
  
  recommendedFriendsList.innerHTML = html;
}

// 刷新推荐好友
function refreshRecommendedFriends() {
  renderRecommendedFriends();
  showSystemNotification('蜻蜓chat', '已为您推荐新的好友');
}

// 发送好友请求
function sendFriendRequest(friendId, friendName) {
  // 模拟发送好友请求
  showSystemNotification('好友请求', `已向 ${friendName} 发送好友请求`);
  
  // 移除已发送请求的好友
  const friendItem = document.querySelector(`.recommended-friend-item`);
  if (friendItem) {
    friendItem.style.opacity = '0.5';
    friendItem.querySelector('button').textContent = '已发送';
    friendItem.querySelector('button').disabled = true;
    friendItem.querySelector('button').style.backgroundColor = '#95a5a6';
  }
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
window.addEventListener('click', function(event) {
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    if (event.target == modal) {
      modal.style.display = 'none';
    }
  });
});

// 拖拽调整大小功能
function initResizeFeature() {
  const wrapper = document.getElementById('chatPanelWrapper');
  if (!wrapper) return;
  
  let isResizing = false;
  let currentDirection = '';
  let startX, startY, startWidth, startHeight, startRight, startBottom;
  
  // 获取所有调整大小的边缘和角落
  const resizeElements = wrapper.querySelectorAll('.resize-edge, .resize-corner');
  
  resizeElements.forEach(el => {
    el.addEventListener('mousedown', function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      isResizing = true;
      currentDirection = this.getAttribute('data-direction');
      
      startX = e.clientX;
      startY = e.clientY;
      startWidth = wrapper.offsetWidth;
      startHeight = wrapper.offsetHeight;
      
      // 获取当前位置
      const rect = wrapper.getBoundingClientRect();
      startRight = window.innerWidth - rect.right;
      startBottom = window.innerHeight - rect.bottom;
      
      document.body.style.cursor = getComputedStyle(this).cursor;
    });
  });
  
  document.addEventListener('mousemove', function(e) {
    if (!isResizing) return;
    
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    
    let newWidth = startWidth;
    let newHeight = startHeight;
    let newRight = startRight;
    let newBottom = startBottom;
    
    // 根据方向调整大小
    switch(currentDirection) {
      case 'right':
        newWidth = startWidth + dx;
        break;
      case 'left':
        newWidth = startWidth - dx;
        newRight = startRight + dx;
        break;
      case 'bottom':
        newHeight = startHeight + dy;
        break;
      case 'top':
        newHeight = startHeight - dy;
        newBottom = startBottom + dy;
        break;
      case 'se':
        newWidth = startWidth + dx;
        newHeight = startHeight + dy;
        break;
      case 'sw':
        newWidth = startWidth - dx;
        newHeight = startHeight + dy;
        newRight = startRight + dx;
        break;
      case 'ne':
        newWidth = startWidth + dx;
        newHeight = startHeight - dy;
        newBottom = startBottom + dy;
        break;
      case 'nw':
        newWidth = startWidth - dx;
        newHeight = startHeight - dy;
        newRight = startRight + dx;
        newBottom = startBottom + dy;
        break;
    }
    
    // 应用最小和最大尺寸限制
    const minWidth = 300;
    const minHeight = 400;
    const maxWidth = 800;
    const maxHeight = 900;
    
    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    newHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
    
    // 应用新尺寸
    wrapper.style.width = newWidth + 'px';
    wrapper.style.height = newHeight + 'px';
    
    // 调整位置（对于从左边或上边调整的情况）
    if (currentDirection.includes('left') || currentDirection.includes('nw') || currentDirection.includes('sw')) {
      wrapper.style.right = newRight + 'px';
    }
    if (currentDirection.includes('top') || currentDirection.includes('nw') || currentDirection.includes('ne')) {
      wrapper.style.bottom = newBottom + 'px';
    }
  });
  
  document.addEventListener('mouseup', function() {
    if (isResizing) {
      isResizing = false;
      currentDirection = '';
      document.body.style.cursor = '';
    }
  });
}

// 初始化聊天器
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    initChatFloat();
    initResizeFeature();
    
    // 蜻蜓图标状态切换
    const dqImg = document.getElementById('dqImg');
    const redDot = document.getElementById('redDot');
    
    // 来消息：飞+红点 
    window.haveNewMsg = function(){
      if (dqImg) {
        dqImg.style.animation = "flap 1s ease-in-out infinite";
      }
      if (redDot) {
        redDot.style.display = "block";
      }
    };
    
    // 无消息：静止+无红点 
    window.noNewMsg = function(){
      if (dqImg) {
        dqImg.style.animation = "none";
      }
      if (redDot) {
        redDot.style.display = "none";
      }
    };
  });
} else {
  initChatFloat();
  initResizeFeature();
  
  // 蜻蜓图标状态切换
  const dqImg = document.getElementById('dqImg');
  const redDot = document.getElementById('redDot');
  
  // 来消息：飞+红点 
  window.haveNewMsg = function(){
    if (dqImg) {
      dqImg.style.animation = "flap 1s ease-in-out infinite";
    }
    if (redDot) {
      redDot.style.display = "block";
    }
  };
  
  // 无消息：静止+无红点 
  window.noNewMsg = function(){
    if (dqImg) {
      dqImg.style.animation = "none";
    }
    if (redDot) {
      redDot.style.display = "none";
    }
  };
}

// ==================== 聊天广场功能 ====================

// 五个广场的配置
const plazaConfig = {
  accounting: {
    name: '会计交流',
    icon: '📊',
    desc: '会计实务/做账技巧',
    theme: '#1976d2',
    bgColor: '#e3f2fd'
  },
  manager: {
    name: '财务经理人',
    icon: '💼',
    desc: '管理/决策/战略',
    theme: '#7b1fa2',
    bgColor: '#f3e5f5'
  },
  certificate: {
    name: '考证专区',
    icon: '📜',
    desc: 'CPA/中级/税务师',
    theme: '#e65100',
    bgColor: '#fff3e0'
  },
  jobs: {
    name: '求职招聘',
    icon: '🎯',
    desc: '招聘/求职/内推',
    theme: '#388e3c',
    bgColor: '#e8f5e9'
  },
  life: {
    name: '生活广场',
    icon: '☕',
    desc: '闲聊/吐槽/兴趣爱好',
    theme: '#c2185b',
    bgColor: '#fce4ec'
  }
};

// 当前选中的广场
let currentPlaza = null;

// 每个广场的状态
let plazaStates = {};

// 初始化所有广场状态
Object.keys(plazaConfig).forEach(key => {
  plazaStates[key] = {
    isJoined: false,
    isMuted: false,
    userCount: 0,
    maxUsers: 500,
    messages: []
  };
});

// 模拟广场用户数据
const plazaUsers = [
  { name: '张会计', avatar: '张' },
  { name: '李财务', avatar: '李' },
  { name: '王经理', avatar: '王' },
  { name: '赵总监', avatar: '赵' },
  { name: '刘专员', avatar: '刘' },
  { name: '陈主管', avatar: '陈' },
  { name: '杨助理', avatar: '杨' },
  { name: '黄出纳', avatar: '黄' }
];

// 每个广场的模拟消息
const plazaMessagesData = {
  accounting: [
    { user: '张会计', content: '大家好，今天增值税申报有什么注意事项吗？', time: '10:30' },
    { user: '李财务', content: '记得检查进项发票是否都认证了', time: '10:32' },
    { user: '王经理', content: '本月的财务报表已经提交了吗？', time: '10:35' },
    { user: '赵总监', content: '请大家注意新的税收政策变化', time: '10:38' }
  ],
  manager: [
    { user: '陈总监', content: '本季度预算执行情况如何？', time: '09:15' },
    { user: '刘经理', content: '建议加强成本控制，优化流程', time: '09:20' },
    { user: '王总监', content: '下季度的战略规划会议定在周三', time: '09:25' }
  ],
  certificate: [
    { user: '考证小白', content: 'CPA会计科目怎么复习效率高？', time: '14:30' },
    { user: '学霸姐姐', content: '建议先刷真题，再看书', time: '14:35' },
    { user: '税务达人', content: '税务师考试今年改革了，注意新大纲', time: '14:40' }
  ],
  jobs: [
    { user: 'HR小王', content: '招聘高级财务分析师，薪资面议', time: '11:00' },
    { user: '求职者小李', content: '有5年工作经验，求内推机会', time: '11:05' },
    { user: '猎头张', content: '某上市公司招财务经理，年薪30W+', time: '11:10' }
  ],
  life: [
    { user: '咖啡控', content: '今天喝了一杯超棒的拿铁☕', time: '15:30' },
    { user: '健身达人', content: '下班去健身房，有人一起吗？', time: '15:35' },
    { user: '美食家', content: '发现一家超好吃的火锅店！', time: '15:40' }
  ]
};

// 选择广场
function selectPlaza(plazaId) {
  currentPlaza = plazaId;
  const config = plazaConfig[plazaId];
  
  // 隐藏选择器，显示聊天区域
  document.getElementById('plaza-selector').style.display = 'none';
  document.getElementById('plaza-chat-container').style.display = 'block';
  
  // 更新广场名称
  document.getElementById('current-plaza-name').textContent = `${config.icon} ${config.name}`;
  document.getElementById('plaza-welcome-name').textContent = config.name;
  
  // 重置聊天区域显示
  const state = plazaStates[plazaId];
  if (state.isJoined) {
    document.getElementById('plaza-not-joined').style.display = 'none';
    document.getElementById('plaza-chat-area').style.display = 'block';
    document.getElementById('plaza-input-area').style.display = 'block';
    document.getElementById('plaza-join-btn').textContent = '退出广场';
    document.getElementById('plaza-join-btn').style.backgroundColor = '#e74c3c';
  } else {
    document.getElementById('plaza-not-joined').style.display = 'block';
    document.getElementById('plaza-chat-area').style.display = 'none';
    document.getElementById('plaza-input-area').style.display = 'none';
    document.getElementById('plaza-join-btn').textContent = '进入广场';
    document.getElementById('plaza-join-btn').style.backgroundColor = '#27ae60';
  }
  
  // 更新免打扰按钮状态
  const muteBtn = document.getElementById('plaza-mute-btn');
  if (state.isMuted) {
    muteBtn.textContent = '免打扰: 开';
    muteBtn.style.backgroundColor = '#e74c3c';
  } else {
    muteBtn.textContent = '免打扰: 关';
    muteBtn.style.backgroundColor = '#95a5a6';
  }
  
  updatePlazaUserCount();
  loadPlazaMessages();
}

// 返回广场选择器
function backToPlazaSelector() {
  // 如果当前在广场中，先退出
  if (currentPlaza && plazaStates[currentPlaza].isJoined) {
    leavePlaza();
  }
  
  currentPlaza = null;
  document.getElementById('plaza-selector').style.display = 'block';
  document.getElementById('plaza-chat-container').style.display = 'none';
}

// 进入/退出广场
function togglePlazaJoin() {
  if (!currentPlaza) return;
  
  if (plazaStates[currentPlaza].isJoined) {
    leavePlaza();
  } else {
    joinPlaza();
  }
}

// 进入广场
function joinPlaza() {
  if (!currentPlaza) return;
  
  const state = plazaStates[currentPlaza];
  state.isJoined = true;
  state.userCount = Math.floor(Math.random() * 200) + 100; // 模拟100-300人在线
  
  // 更新UI
  document.getElementById('plaza-not-joined').style.display = 'none';
  document.getElementById('plaza-chat-area').style.display = 'block';
  document.getElementById('plaza-input-area').style.display = 'block';
  document.getElementById('plaza-join-btn').textContent = '退出广场';
  document.getElementById('plaza-join-btn').style.backgroundColor = '#e74c3c';
  
  updatePlazaUserCount();
  loadPlazaMessages();
  
  // 显示进入消息
  const config = plazaConfig[currentPlaza];
  addPlazaSystemMessage(`您已进入${config.name}`);
}

// 退出广场
function leavePlaza() {
  if (!currentPlaza) return;
  
  const state = plazaStates[currentPlaza];
  state.isJoined = false;
  state.userCount = 0;
  
  // 更新UI
  document.getElementById('plaza-not-joined').style.display = 'block';
  document.getElementById('plaza-chat-area').style.display = 'none';
  document.getElementById('plaza-input-area').style.display = 'none';
  document.getElementById('plaza-join-btn').textContent = '进入广场';
  document.getElementById('plaza-join-btn').style.backgroundColor = '#27ae60';
  
  updatePlazaUserCount();
}

// 切换免打扰模式
function togglePlazaMute() {
  if (!currentPlaza) return;
  
  const state = plazaStates[currentPlaza];
  state.isMuted = !state.isMuted;
  const muteBtn = document.getElementById('plaza-mute-btn');
  
  if (state.isMuted) {
    muteBtn.textContent = '免打扰: 开';
    muteBtn.style.backgroundColor = '#e74c3c';
    addPlazaSystemMessage('已开启免打扰模式');
  } else {
    muteBtn.textContent = '免打扰: 关';
    muteBtn.style.backgroundColor = '#95a5a6';
    addPlazaSystemMessage('已关闭免打扰模式');
  }
}

// 更新广场在线人数
function updatePlazaUserCount() {
  if (!currentPlaza) return;
  
  const countElement = document.getElementById('plaza-user-count');
  const state = plazaStates[currentPlaza];
  if (countElement) {
    countElement.textContent = `当前在线: ${state.userCount}/500人`;
  }
}

// 加载广场消息
function loadPlazaMessages() {
  if (!currentPlaza) return;
  
  const chatArea = document.getElementById('plaza-chat-area');
  if (!chatArea) return;
  
  chatArea.innerHTML = '';
  
  const messages = plazaMessagesData[currentPlaza] || [];
  messages.forEach(msg => {
    addPlazaMessage(msg.user, msg.content, msg.time, false);
  });
  
  chatArea.scrollTop = chatArea.scrollHeight;
}

// 添加广场消息
function addPlazaMessage(userName, content, time, isSelf = false) {
  const chatArea = document.getElementById('plaza-chat-area');
  if (!chatArea) return;
  
  const user = plazaUsers.find(u => u.name === userName) || { name: userName, avatar: userName[0] };
  
  const messageDiv = document.createElement('div');
  messageDiv.style.cssText = 'margin-bottom: 12px; display: flex; gap: 8px; align-items: flex-start;';
  
  if (isSelf) {
    messageDiv.style.flexDirection = 'row-reverse';
  }
  
  messageDiv.innerHTML = `
    <div style="width: 32px; height: 32px; border-radius: 50%; background-color: #3498db; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; flex-shrink: 0;">${user.avatar}</div>
    <div style="max-width: 70%;">
      <div style="font-size: 12px; color: #666; margin-bottom: 2px;">${userName} ${time}</div>
      <div style="background-color: ${isSelf ? '#3498db' : 'white'}; color: ${isSelf ? 'white' : '#333'}; padding: 8px 12px; border-radius: 12px; font-size: 13px; word-wrap: break-word; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">${content}</div>
    </div>
  `;
  
  chatArea.appendChild(messageDiv);
  chatArea.scrollTop = chatArea.scrollHeight;
}

// 添加系统消息
function addPlazaSystemMessage(content) {
  const chatArea = document.getElementById('plaza-chat-area');
  if (!chatArea) return;
  
  const systemDiv = document.createElement('div');
  systemDiv.style.cssText = 'text-align: center; margin: 10px 0;';
  systemDiv.innerHTML = `
    <span style="background-color: #e8e8e8; color: #666; padding: 4px 12px; border-radius: 10px; font-size: 12px;">${content}</span>
  `;
  
  chatArea.appendChild(systemDiv);
  chatArea.scrollTop = chatArea.scrollHeight;
}

// 发送广场消息
function sendPlazaMessage() {
  if (!currentPlaza) return;
  
  const input = document.getElementById('plaza-message-input');
  if (!input) return;
  
  const message = input.value.trim();
  if (!message) return;
  
  const state = plazaStates[currentPlaza];
  if (!state.isJoined) {
    alert('请先进入聊天广场');
    return;
  }
  
  const now = new Date();
  const time = now.getHours() + ':' + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
  
  // 添加自己的消息
  addPlazaMessage('我', message, time, true);
  
  // 清空输入框
  input.value = '';
  
  // 模拟其他用户回复（随机）
  if (Math.random() > 0.5) {
    setTimeout(() => {
      const randomUser = plazaUsers[Math.floor(Math.random() * plazaUsers.length)];
      
      // 根据广场类型生成不同的回复
      const replies = {
        accounting: ['说得对！', '同意您的观点', '谢谢分享', '我也遇到了同样的问题', '有什么好的解决方案吗？', '学习了！'],
        manager: ['确实如此', '值得思考', '有经验', '受教了', '很好的建议'],
        certificate: ['加油！', '一起努力', '考试顺利', '谢谢分享经验', '很有帮助'],
        jobs: ['感兴趣', '怎么联系？', '期待合作', '简历已投', '感谢分享'],
        life: ['哈哈', '不错哦', '羡慕', '周末愉快', '一起呀']
      };
      
      const plazaReplies = replies[currentPlaza] || replies.accounting;
      const randomReply = plazaReplies[Math.floor(Math.random() * plazaReplies.length)];
      addPlazaMessage(randomUser.name, randomReply, time, false);
    }, 2000 + Math.random() * 3000);
  }
}

// ==================== 圈子功能 ====================

// 当前圈子信息
let currentCircle = {
  type: '', // 'industry' 或 'city'
  name: '',
  isJoined: false
};

// 圈子模拟消息
const circleMessages = {
  industry: {
    '制造业': [
      { user: '厂长李', content: '本月生产成本控制得不错', time: '10:00' },
      { user: '工程师王', content: '新设备已经调试完成', time: '09:30' }
    ],
    '金融业': [
      { user: '分析师张', content: '今天股市行情看好', time: '10:15' },
      { user: '基金经理刘', content: '推荐关注新能源板块', time: '09:45' }
    ],
    '房地产': [
      { user: '销售总监', content: '本月成交量有所回升', time: '10:30' },
      { user: '项目经理', content: '新楼盘即将开盘', time: '09:00' }
    ],
    '互联网': [
      { user: '产品经理', content: '新功能已经上线测试', time: '10:20' },
      { user: '程序员小陈', content: '代码review请尽快处理', time: '09:50' }
    ],
    '零售业': [
      { user: '店长赵', content: '双11活动准备得怎么样了？', time: '10:10' },
      { user: '采购王', content: '新一批货品已到', time: '09:40' }
    ],
    '服务业': [
      { user: '客服经理', content: '客户满意度提升了5%', time: '10:05' },
      { user: '培训师李', content: '新员工培训计划已制定', time: '09:35' }
    ],
    '医疗健康': [
      { user: '主任医生', content: '新设备操作培训安排在周三', time: '10:25' },
      { user: '护士长', content: '护理质量检查报告已出', time: '09:55' }
    ],
    '教育培训': [
      { user: '校长', content: '下学期课程安排已确定', time: '10:00' },
      { user: '教务老师', content: '教师培训报名开始', time: '09:30' }
    ],
    '再生资源': [
      { user: '回收站李', content: '今天废纸回收价格上涨了', time: '10:00' },
      { user: '分拣员王', content: '塑料分拣线已调试完成', time: '09:30' },
      { user: '环保达人', content: '垃圾分类真的很重要', time: '09:00' }
    ],
    '电商': [
      { user: '淘宝卖家', content: '双11活动准备中', time: '10:00' },
      { user: '电商运营', content: '今天流量不错', time: '09:30' },
      { user: '直播带货', content: '今晚7点有直播', time: '09:00' }
    ],
    '跨境电商': [
      { user: '亚马逊卖家', content: 'Prime Day准备中', time: '10:00' },
      { user: '跨境物流', content: '欧美航线稳定', time: '09:30' },
      { user: '独立站运营', content: '广告投放效果不错', time: '09:00' }
    ]
  },
  city: {
    '北京': [
      { user: '北漂小王', content: '今天北京的天气真不错', time: '10:00' },
      { user: '金融从业者', content: '国贸附近有新开的咖啡店', time: '09:30' }
    ],
    '上海': [
      { user: '魔都白领', content: '外滩的夜景真美', time: '10:15' },
      { user: '创业者', content: '张江有新的创业政策', time: '09:45' }
    ],
    '广州': [
      { user: '老广阿明', content: '早茶推荐去点都德', time: '10:30' },
      { user: '外贸人', content: '广交会准备中', time: '09:00' }
    ],
    '深圳': [
      { user: '深漂小李', content: '南山科技园机会多', time: '10:20' },
      { user: 'HR小王', content: '招聘季开始了', time: '09:50' }
    ],
    '杭州': [
      { user: '阿里人', content: '西湖边适合散步', time: '10:10' },
      { user: '电商卖家', content: '淘宝新规要注意', time: '09:40' }
    ],
    '成都': [
      { user: '成都土著', content: '火锅推荐蜀大侠', time: '10:05' },
      { user: '程序员', content: '天府软件园环境好', time: '09:35' }
    ],
    '武汉': [
      { user: '武汉伢', content: '热干面还是蔡林记正宗', time: '10:25' },
      { user: '大学生', content: '光谷就业机会多', time: '09:55' }
    ],
    '西安': [
      { user: '西安人', content: '回民街小吃推荐', time: '10:00' },
      { user: '导游', content: '兵马俑游客很多', time: '09:30' }
    ]
  }
};

// 选择圈子类型
function selectCircleType(type) {
  document.getElementById('circles-selector').style.display = 'none';
  
  if (type === 'industry') {
    document.getElementById('industry-circles').style.display = 'block';
    document.getElementById('city-circles').style.display = 'none';
  } else {
    document.getElementById('industry-circles').style.display = 'none';
    document.getElementById('city-circles').style.display = 'block';
  }
}

// 返回圈子选择器
function backToCircleSelector() {
  document.getElementById('circles-selector').style.display = 'block';
  document.getElementById('industry-circles').style.display = 'none';
  document.getElementById('city-circles').style.display = 'none';
  document.getElementById('circle-chat-container').style.display = 'none';
  
  currentCircle = { type: '', name: '', isJoined: false };
}

// 加入行业圈子
function joinIndustryCircle(industryName) {
  currentCircle = {
    type: 'industry',
    name: industryName,
    isJoined: true
  };
  
  // 隐藏选择器，显示聊天区域
  document.getElementById('industry-circles').style.display = 'none';
  document.getElementById('city-circles').style.display = 'none';
  document.getElementById('circle-chat-container').style.display = 'block';
  
  // 更新圈子信息
  document.getElementById('current-circle-name').textContent = `🏭 ${industryName}圈`;
  document.getElementById('circle-member-count').textContent = `成员: ${Math.floor(Math.random() * 500) + 100}人`;
  
  // 加载圈子消息
  loadCircleMessages();
  
  // 显示加入消息
  addCircleSystemMessage(`您已加入${industryName}行业圈`);
}

// 加入同城圈子
function joinCityCircle(cityName) {
  currentCircle = {
    type: 'city',
    name: cityName,
    isJoined: true
  };
  
  // 隐藏选择器，显示聊天区域
  document.getElementById('industry-circles').style.display = 'none';
  document.getElementById('city-circles').style.display = 'none';
  document.getElementById('circle-chat-container').style.display = 'block';
  
  // 更新圈子信息
  document.getElementById('current-circle-name').textContent = `🏙️ ${cityName}圈`;
  document.getElementById('circle-member-count').textContent = `成员: ${Math.floor(Math.random() * 800) + 200}人`;
  
  // 加载圈子消息
  loadCircleMessages();
  
  // 显示加入消息
  addCircleSystemMessage(`您已加入${cityName}同城圈`);
}

// 退出圈子
function leaveCircle() {
  if (confirm('确定要退出当前圈子吗？')) {
    currentCircle = { type: '', name: '', isJoined: false };
    backToCircleSelector();
  }
}

// 加载圈子消息
function loadCircleMessages() {
  const chatArea = document.getElementById('circle-chat-area');
  if (!chatArea) return;
  
  chatArea.innerHTML = '';
  
  if (currentCircle.type && currentCircle.name) {
    const messages = circleMessages[currentCircle.type][currentCircle.name] || [];
    messages.forEach(msg => {
      addCircleMessage(msg.user, msg.content, msg.time, false);
    });
  }
  
  chatArea.scrollTop = chatArea.scrollHeight;
}

// 添加圈子消息
function addCircleMessage(userName, content, time, isSelf = false) {
  const chatArea = document.getElementById('circle-chat-area');
  if (!chatArea) return;
  
  const messageDiv = document.createElement('div');
  messageDiv.style.cssText = 'margin-bottom: 12px; display: flex; gap: 8px; align-items: flex-start;';
  
  if (isSelf) {
    messageDiv.style.flexDirection = 'row-reverse';
  }
  
  const avatar = userName[0];
  
  messageDiv.innerHTML = `
    <div style="width: 32px; height: 32px; border-radius: 50%; background-color: #3498db; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; flex-shrink: 0;">${avatar}</div>
    <div style="max-width: 70%;">
      <div style="font-size: 12px; color: #666; margin-bottom: 2px;">${userName} ${time}</div>
      <div style="background-color: ${isSelf ? '#3498db' : 'white'}; color: ${isSelf ? 'white' : '#333'}; padding: 8px 12px; border-radius: 12px; font-size: 13px; word-wrap: break-word; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">${content}</div>
    </div>
  `;
  
  chatArea.appendChild(messageDiv);
  chatArea.scrollTop = chatArea.scrollHeight;
}

// 添加圈子系统消息
function addCircleSystemMessage(content) {
  const chatArea = document.getElementById('circle-chat-area');
  if (!chatArea) return;
  
  const systemDiv = document.createElement('div');
  systemDiv.style.cssText = 'text-align: center; margin: 10px 0;';
  systemDiv.innerHTML = `
    <span style="background-color: #e8e8e8; color: #666; padding: 4px 12px; border-radius: 10px; font-size: 12px;">${content}</span>
  `;
  
  chatArea.appendChild(systemDiv);
  chatArea.scrollTop = chatArea.scrollHeight;
}

// 发送圈子消息
function sendCircleMessage() {
  const input = document.getElementById('circle-message-input');
  if (!input) return;
  
  const message = input.value.trim();
  if (!message) return;
  
  if (!currentCircle.isJoined) {
    alert('请先加入圈子');
    return;
  }
  
  const now = new Date();
  const time = now.getHours() + ':' + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
  
  // 添加自己的消息
  addCircleMessage('我', message, time, true);
  
  // 清空输入框
  input.value = '';
  
  // 模拟其他用户回复（随机）
  if (Math.random() > 0.5) {
    setTimeout(() => {
      const randomUsers = ['财务达人', '会计小王', '税务专家', '审计师李', '财务经理'];
      const randomUser = randomUsers[Math.floor(Math.random() * randomUsers.length)];
      const replies = ['说得对！', '同意', '学习了', '谢谢分享', '很有用'];
      const randomReply = replies[Math.floor(Math.random() * replies.length)];
      addCircleMessage(randomUser, randomReply, time, false);
    }, 2000 + Math.random() * 3000);
  }
}
