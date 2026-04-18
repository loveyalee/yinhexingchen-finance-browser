// 蜻蜓聊天器功能
const acAgents = {
  claw: { name: 'Ac-claw', icon: '🦞', tone: '擅长票据归类、科目建议、税负提醒。' },
  agent: { name: 'Ac-agent', icon: '🪐', tone: '擅长记账、报税、分析与经营解释。' }
};

const acPrompts = [
  '帮我生成销售收入凭证',
  '整理本月增值税申报清单',
  '分析待审核凭证风险点',
  '生成月末结账待办'
];

function financeReply(q, mode) {
  if (/好友|同城|圈子|广场/.test(q)) return '蜻蜓chat 已恢复好友、群聊、同城圈子和 AI 工作台。';
  if (/凭证|记账/.test(q)) return '建议先确认摘要与单据，再匹配会计科目和借贷方向，最后检查税率与附件。';
  if (/报税|申报|增值税/.test(q)) return '建议按销项汇总、进项勾选、税额测算、附加税校验、资料归档的顺序推进。';
  if (/分析|利润|报表/.test(q)) return '建议重点看利润率、应收与现金流背离、费用异常波动三项指标。';
  return (mode === 'claw' ? 'Ac-claw' : 'Ac-agent') + ' 已收到，请继续输入你的财税问题。';
}

function showSystemNotification(title, message) {
  const n = document.createElement('div');
  n.style.cssText = 'position:fixed;right:20px;bottom:106px;z-index:10002;background:#17324b;color:#fff;padding:12px 14px;border-radius:14px;box-shadow:0 10px 24px rgba(0,0,0,.22);max-width:320px';
  n.innerHTML = '<div style="font-weight:700;margin-bottom:4px">' + title + '</div><div style="opacity:.9;line-height:1.6">' + message + '</div>';
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 2600);
}

function initChatFloat() {
  // 创建聊天器HTML
  const chatFloatHTML = `
    <!-- 悬浮聊天器 -->
    <div class="chat-float" style="display: block; position: fixed; bottom: 30px; right: 30px; z-index: 9999;">
      <button class="chat-toggle" onclick="toggleChatPanel()" style="display: flex; width: 90px; height: 90px; background: none; border: none; font-size: 50px; cursor: pointer; transition: all 0.3s; align-items: flex-start; justify-content: center; padding-top: 5px;">
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
          <div class="chat-panel-tab" data-tab="plaza" style="flex: 1; padding: 12px; text-align: center; cursor: pointer; border-bottom: 2px solid transparent;">圈子</div>
          <div class="chat-panel-tab" data-tab="ai" style="flex: 1; padding: 12px; text-align: center; cursor: pointer; border-bottom: 2px solid transparent;">AI</div>
        </div>
        <div class="chat-panel-content" style="flex: 1; padding: 15px; overflow-y: auto;">
          <!-- 好友列表 -->
          <div id="friends-tab" class="chat-panel-tab-content active" style="display: block;">
            <button class="add-friend-btn" onclick="openAddFriendModal()" style="width: 100%; padding: 10px; background-color: #f0f0f0; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; margin-bottom: 15px; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <span>➕</span> 添加好友
            </button>
            <div id="friends-list-container" class="chat-list" style="display: flex; flex-direction: column; gap: 10px;">
              <!-- 好友将动态加载到这里 -->
            </div>
            <div id="friends-empty-tip" style="text-align: center; padding: 40px 20px; color: #999; display: none;">
              <div style="font-size: 48px; margin-bottom: 15px;">👥</div>
              <div style="font-size: 14px; margin-bottom: 10px;">还没有好友</div>
              <div style="font-size: 12px;">登录后可以添加好友</div>
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
          
          <!-- 圈子 -->
          <div id="plaza-tab" class="chat-panel-tab-content" style="display: none;">
            <div id="circles-category-tabs" style="display: flex; gap: 8px; margin-bottom: 15px; overflow-x: auto; padding-bottom: 10px; border-bottom: 1px solid #e0e0e0;">
              <!-- 分类标签将动态加载到这里 -->
            </div>

            <div id="circles-list-container" style="display: flex; flex-direction: column; gap: 10px; max-height: 350px; overflow-y: auto;">
              <!-- 圈子列表将动态加载到这里 -->
            </div>

            <div id="circle-detail-view" style="display: none;">
              <button onclick="backToCirclesList()" style="padding: 8px 12px; background-color: #f0f0f0; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-bottom: 15px;">← 返回圈子列表</button>

              <div id="circle-detail-header" style="padding: 15px; background-color: #f8f9fa; border-radius: 6px; margin-bottom: 15px;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 10px;">
                  <span id="circle-detail-icon" style="font-size: 32px;"></span>
                  <div>
                    <div id="circle-detail-name" style="font-weight: bold; font-size: 16px; color: #2c3e50;"></div>
                    <div id="circle-detail-desc" style="font-size: 12px; color: #666; margin-top: 4px;"></div>
                  </div>
                </div>
                <div id="circle-detail-stats" style="font-size: 12px; color: #999; margin-bottom: 10px;"></div>
                <button id="circle-join-btn" onclick="toggleCircleJoin()" style="width: 100%; padding: 10px; background-color: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">加入圈子</button>
              </div>

              <div id="circle-chat-area" style="height: 200px; overflow-y: auto; border: 1px solid #e0e0e0; border-radius: 6px; padding: 10px; background-color: #f8f9fa; margin-bottom: 10px;">
                <!-- 圈子消息将在这里显示 -->
              </div>

              <div id="circle-input-area" style="display: none;">
                <div style="display: flex; gap: 10px;">
                  <input type="text" id="circle-message-input" placeholder="输入消息..." style="flex: 1; padding: 10px; border: 1px solid #e0e0e0; border-radius: 4px; outline: none;" onkeypress="if(event.key==='Enter')sendCircleMessage()">
                  <button onclick="sendCircleMessage()" style="padding: 10px 20px; background-color: #3498db; color: white; border: none; border-radius: 4px; cursor: pointer;">发送</button>
                </div>
              </div>
            </div>
          </div>

          <div id="ai-tab" class="chat-panel-tab-content" style="display: none;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
              <button onclick="switchAgent('claw')" id="ac-claw-btn" style="padding:12px;border-radius:16px;border:1px solid #d7e4f1;background:#fff;cursor:pointer;text-align:left;">
                <div style="font-weight:800">🦞 Ac-claw</div>
                <div style="font-size:12px;color:#6b7e92;margin-top:4px">票据 / 科目 / 税负</div>
              </button>
              <button onclick="switchAgent('agent')" id="ac-agent-btn" style="padding:12px;border-radius:16px;border:1px solid #bdd5ed;background:linear-gradient(135deg,#eef6ff,#dfeefa);cursor:pointer;text-align:left;">
                <div style="font-weight:800">🪐 Ac-agent</div>
                <div style="font-size:12px;color:#6b7e92;margin-top:4px">记账 / 报税 / 分析</div>
              </button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px;">
              ${acPrompts.map(p=>`<button onclick="injectPrompt('${p}')" style="padding:8px 10px;border-radius:12px;border:1px solid #dbe7f2;background:#fff;cursor:pointer;font-size:12px;text-align:left;">${p}</button>`).join('')}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
              <span style="padding:6px 10px;border-radius:999px;background:#eef5fb;color:#31506d;font-size:12px">当前模式：<b id="acModeLabel">Ac-agent</b></span>
              <span style="padding:6px 10px;border-radius:999px;background:#eef5fb;color:#31506d;font-size:12px">账套协同</span>
              <span style="padding:6px 10px;border-radius:999px;background:#eef5fb;color:#31506d;font-size:12px">票税联动</span>
            </div>
            <div id="aiChatMessages" style="height:260px;overflow:auto;padding:12px;background:linear-gradient(180deg,#f8fbff,#fdfefe);border:1px solid #e3edf7;border-radius:16px;">
              <div style="display:flex;gap:10px;margin-bottom:14px;">
                <div style="width:38px;height:38px;border-radius:50%;background:#163a62;color:#fff;display:flex;align-items:center;justify-content:center;">🪐</div>
                <div style="max-width:78%;background:#fff;border:1px solid #e3edf7;border-radius:16px;padding:12px 14px;line-height:1.7;">
                  <div style="font-weight:700;margin-bottom:4px;">Ac-agent</div>
                  <div>你好，我已经恢复为融合版蜻蜓chat。现在你既可以加好友、进群、逛广场，也可以继续做财务 AI 问答。</div>
                </div>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr auto;gap:10px;margin-top:12px;">
              <textarea id="aiChatInput" placeholder="例如：请帮我生成一张销售废旧金属收入凭证" style="min-height:72px;max-height:140px;padding:12px 14px;border-radius:16px;border:1px solid #d8e5f0;resize:vertical;font:inherit;outline:none;"></textarea>
              <button onclick="sendAiMessage()" style="width:68px;border:none;border-radius:18px;background:linear-gradient(135deg,#1d64ae,#0f4d8e);color:#fff;font-weight:800;cursor:pointer;">发送</button>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
              <div style="font-size:12px;color:#6b7e92;">支持聊天式记账、报税、分析与财务协同</div>
              <button onclick="clearFinanceChat()" style="border:none;background:none;color:#1d64ae;cursor:pointer;font-size:12px;">清空会话</button>
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
          <button class="btn btn-primary" onclick="submitAddFriendRequest()" style="padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; background-color: #3498db; color: white;">发送请求</button>
        </div>
      </div>
    </div>
  `;
  
  // 将聊天器添加到页面底部
  document.body.insertAdjacentHTML('beforeend', chatFloatHTML);
  
  // 绑定标签切换事件
  const bindChatFloatEvents = function() {
    // 检查登录状态，控制好友列表显示
    const checkLoginStatus = function() {
      const userInfo = JSON.parse(localStorage.getItem('userInfo') || 'null');
      const isLoggedIn = userInfo && (userInfo.isLoggedIn || userInfo.id);

      const friendsListContainer = document.getElementById('friends-list-container');
      const friendsEmptyTip = document.getElementById('friends-empty-tip');

      if (isLoggedIn) {
        // 已登录：显示好友列表
        friendsListContainer.style.display = 'flex';
        friendsEmptyTip.style.display = 'none';
        hydrateAddedFriends();
      } else {
        // 未登录：显示空提示
        friendsListContainer.style.display = 'none';
        friendsEmptyTip.style.display = 'block';
      }
    };

    checkLoginStatus();
    hydrateAiMessages();
    if (plazaState.isJoined) {
      setTimeout(() => {
        const plazaTab = document.getElementById('plaza-tab');
        if (plazaTab && plazaTab.style.display !== 'none') {
          loadPlazaMessages();
        }
      }, 0);
    }
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
        if (tabId === 'plaza') {
          loadPlazaMessages();
        }
        if (tabId === 'ai') {
          setDragonflyUnread(false);
        }
        if (tabId === 'plaza' && !circlesConfig) {
          loadCirclesConfig();
        }
      });
    });
    
    // 绑定按Enter发送消息事件
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
      chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendSocialMessage();
        }
      });
    }

    const aiChatInput = document.getElementById('aiChatInput');
    if (aiChatInput) {
      aiChatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendAiMessage();
        }
      });
    }

    const aiTab = document.querySelector('.chat-panel-tab[data-tab="ai"]');
    if (aiTab) {
      aiTab.addEventListener('click', function() {
        const label = document.getElementById('acModeLabel');
        if (label) label.textContent = acAgents[window.__acMode || 'agent'].name;
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindChatFloatEvents, { once: true });
  } else {
    bindChatFloatEvents();
  }
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
  renderSocialConversation(title);
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
function sendSocialMessage() {
  const textarea = document.getElementById('chatInput');
  const message = textarea.value.trim();
  if (message) {
    const chatMessages = document.getElementById('chatMessages');
    const chatTitle = document.getElementById('chatTitle');
    const currentTitle = chatTitle ? chatTitle.textContent.trim() : '默认会话';
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
        <div>${escapeHtml(message)}</div>
        <div class="message-time" style="font-size: 12px; color: rgba(255, 255, 255, 0.7); margin-top: 5px; text-align: right;">${time}</div>
      </div>
      <div class="message-avatar" style="width: 36px; height: 36px; border-radius: 50%; background-color: #3498db; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">我</div>
    `;
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    persistSocialMessage(currentTitle, message, 'sent', time);
    textarea.value = '';
  }
}

function appendAiMessage(role, text, type, persist = true) {
  const box = document.getElementById('aiChatMessages');
  if (!box) return;
  const mine = type === 'sent';
  const icon = mine ? '我' : (window.__acMode === 'claw' ? '🦞' : '🪐');
  const bg = mine ? 'linear-gradient(135deg,#1d64ae,#0f4d8e)' : '#fff';
  const color = mine ? '#fff' : '#17324b';
  const border = mine ? 'none' : '1px solid #e3edf7';
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;gap:10px;margin-bottom:14px;justify-content:' + (mine ? 'flex-end' : 'flex-start');
  wrap.innerHTML =
    (mine ? '' : '<div style="width:38px;height:38px;border-radius:50%;background:#163a62;color:#fff;display:flex;align-items:center;justify-content:center">' + icon + '</div>') +
    '<div style="max-width:78%;background:' + bg + ';color:' + color + ';border:' + border + ';border-radius:16px;padding:12px 14px;line-height:1.7"><div style="font-weight:700;margin-bottom:4px">' + role + '</div><div>' + text.replace(/\n/g, '<br>') + '</div></div>' +
    (mine ? '<div style="width:38px;height:38px;border-radius:50%;background:#1d64ae;color:#fff;display:flex;align-items:center;justify-content:center">我</div>' : '');
  box.appendChild(wrap);
  box.scrollTop = box.scrollHeight;

  if (persist) {
    const stored = loadChatStorage(CHAT_STORAGE_KEYS.aiMessages, []);
    stored.push({ role, text, type });
    saveChatStorage(CHAT_STORAGE_KEYS.aiMessages, stored.slice(-40));
  }
}

function sendAiMessage() {
  const input = document.getElementById('aiChatInput');
  if (!input || !input.value.trim()) return;
  const q = input.value.trim();
  appendAiMessage('我', q, 'sent');
  const mode = window.__acMode || 'agent';
  const role = acAgents[mode].name;
  input.value = '';
  setTimeout(() => {
    appendAiMessage(role, financeReply(q, mode), 'received');
  }, 420);
}

function sendMessage() {
  sendSocialMessage();
}

function clearFinanceChat() {
  const box = document.getElementById('aiChatMessages');
  if (!box) return;
  box.innerHTML = '';
  saveChatStorage(CHAT_STORAGE_KEYS.aiMessages, []);
  appendAiMessage('Ac-agent', 'AI 会话已清空。你可以重新开始，例如：帮我整理本月报税清单。', 'received');
}

function switchAgent(mode){window.__acMode=mode;const claw=document.getElementById('ac-claw-btn'),agent=document.getElementById('ac-agent-btn'),label=document.getElementById('acModeLabel');if(label)label.textContent=acAgents[mode].name;if(claw&&agent){claw.style.background=mode==='claw'?'linear-gradient(135deg,#eef6ff,#dfeefa)':'#fff';claw.style.borderColor=mode==='claw'?'#bdd5ed':'#d7e4f1';agent.style.background=mode==='agent'?'linear-gradient(135deg,#eef6ff,#dfeefa)':'#fff';agent.style.borderColor=mode==='agent'?'#bdd5ed':'#d7e4f1';}}
function injectPrompt(text){const aiTab=document.querySelector('.chat-panel-tab[data-tab="ai"]');if(aiTab)aiTab.click();const i=document.getElementById('aiChatInput');if(i){i.value=text;i.focus()}}

// 打开模态框
function openAddFriendModal() {
  openModal('addFriendModal');
}

// 添加好友弹窗发送
const CHAT_STORAGE_KEYS = {
  aiMessages: 'dragonfly_ai_messages_v1',
  addedFriends: 'dragonfly_added_friends_v1',
  addFriendRequests: 'dragonfly_add_friend_requests_v1',
  socialMessages: 'dragonfly_social_messages_v1',
  plazaState: 'dragonfly_plaza_state_v1',
  plazaMessages: 'dragonfly_plaza_messages_v1'
};

function loadChatStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function saveChatStorage(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSocialMessages() {
  return loadChatStorage(CHAT_STORAGE_KEYS.socialMessages, {});
}

function saveSocialMessages(map) {
  saveChatStorage(CHAT_STORAGE_KEYS.socialMessages, map);
}

function renderSocialConversation(title) {
  const box = document.getElementById('chatMessages');
  if (!box) return;
  const socialMap = getSocialMessages();
  const list = socialMap[title] || null;
  if (!list || !list.length) return;
  box.innerHTML = '';
  list.forEach(item => {
    const messageElement = document.createElement('div');
    messageElement.className = 'message ' + item.type;
    messageElement.style.marginBottom = '15px';
    messageElement.style.display = 'flex';
    messageElement.style.gap = '10px';
    messageElement.style.justifyContent = item.type === 'sent' ? 'flex-end' : 'flex-start';
    if (item.type === 'sent') {
      messageElement.innerHTML = `
        <div class="message-content" style="max-width: 70%; padding: 10px 15px; border-radius: 18px; word-wrap: break-word; background-color: #3498db; color: white; border-bottom-right-radius: 4px;">
          <div>${escapeHtml(item.text)}</div>
          <div class="message-time" style="font-size: 12px; color: rgba(255, 255, 255, 0.7); margin-top: 5px; text-align: right;">${escapeHtml(item.time)}</div>
        </div>
        <div class="message-avatar" style="width: 36px; height: 36px; border-radius: 50%; background-color: #3498db; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">我</div>`;
    } else {
      messageElement.innerHTML = `
        <div class="message-avatar" style="width: 36px; height: 36px; border-radius: 50%; background-color: #3498db; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px;">${escapeHtml(title.slice(0,1))}</div>
        <div class="message-content" style="max-width: 70%; padding: 10px 15px; border-radius: 18px; word-wrap: break-word; background-color: white; border-bottom-left-radius: 4px;">
          <div>${escapeHtml(item.text)}</div>
          <div class="message-time" style="font-size: 12px; color: #999; margin-top: 5px; text-align: right;">${escapeHtml(item.time)}</div>
        </div>`;
    }
    box.appendChild(messageElement);
  });
  box.scrollTop = box.scrollHeight;
}

function persistSocialMessage(title, text, type, time) {
  const socialMap = getSocialMessages();
  socialMap[title] = socialMap[title] || [];
  socialMap[title].push({ text, type, time });
  saveSocialMessages(socialMap);
}

function hydrateAiMessages() {
  const box = document.getElementById('aiChatMessages');
  if (!box) return;
  const stored = loadChatStorage(CHAT_STORAGE_KEYS.aiMessages, []);
  if (!stored.length) return;
  box.innerHTML = '';
  stored.forEach(item => appendAiMessage(item.role, item.text, item.type, false));
}

function hydrateAddedFriends() {
  const list = document.querySelector('#friends-tab .chat-list');
  if (!list) return;
  const storedFriends = loadChatStorage(CHAT_STORAGE_KEYS.addedFriends, []);
  storedFriends.slice().reverse().forEach(friend => {
    const card = document.createElement('div');
    card.className = 'chat-item';
    card.setAttribute('onclick', `openChat('${friend.name.replace(/'/g, "\\'")}')`);
    card.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px;border-radius:6px;cursor:pointer;transition:background-color 0.3s;';
    card.innerHTML = `
      <div class="chat-item-avatar" style="width: 40px; height: 40px; border-radius: 50%; background-color: #3498db; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold;">${escapeHtml(friend.name.slice(0, 1))}</div>
      <div class="chat-item-info" style="flex: 1;">
        <div class="chat-item-name" style="font-weight: bold; font-size: 14px; color: #2c3e50;">${escapeHtml(friend.name)}</div>
        <div class="chat-item-preview" style="font-size: 12px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(friend.preview || '我们已经成为好友，开始聊天吧')}</div>
      </div>
      <div class="chat-item-time" style="font-size: 12px; color: #999;">${escapeHtml(friend.time || '刚刚')}</div>
    `;
    list.prepend(card);
  });
}

function hydratePlazaState() {
  const savedState = loadChatStorage(CHAT_STORAGE_KEYS.plazaState, null);
  const savedMessages = loadChatStorage(CHAT_STORAGE_KEYS.plazaMessages, null);
  if (savedState) {
    plazaState = { ...plazaState, ...savedState };
  }
  if (Array.isArray(savedMessages) && savedMessages.length) {
    plazaMessages.length = 0;
    savedMessages.forEach(msg => plazaMessages.push(msg));
  }
}

function persistPlazaState() {
  saveChatStorage(CHAT_STORAGE_KEYS.plazaState, {
    isJoined: plazaState.isJoined,
    isMuted: plazaState.isMuted,
    userCount: plazaState.userCount,
    maxUsers: plazaState.maxUsers
  });
  saveChatStorage(CHAT_STORAGE_KEYS.plazaMessages, plazaMessages);
}

function setDragonflyUnread(hasUnread) {
  const dqImg = document.getElementById('dqImg');
  const redDot = document.getElementById('redDot');
  if (hasUnread) {
    if (dqImg) dqImg.style.animation = "flap 1s ease-in-out infinite";
    if (redDot) redDot.style.display = "block";
  } else {
    if (dqImg) dqImg.style.animation = "none";
    if (redDot) redDot.style.display = "none";
  }
}

const addFriendRequests = loadChatStorage(CHAT_STORAGE_KEYS.addFriendRequests, []);

function submitAddFriendRequest() {
  const modal = document.getElementById('addFriendModal');
  if (!modal) return;
  const nameInput = modal.querySelector('input[type="text"]');
  const messageInput = modal.querySelector('textarea');
  const name = nameInput ? nameInput.value.trim() : '';
  const message = messageInput ? messageInput.value.trim() : '';

  if (!name) {
    alert('请输入好友名称或账号');
    return;
  }

  const request = { name, message, time: new Date().toLocaleString() };
  addFriendRequests.push(request);
  saveChatStorage(CHAT_STORAGE_KEYS.addFriendRequests, addFriendRequests);

  const addedFriends = loadChatStorage(CHAT_STORAGE_KEYS.addedFriends, []);
  const socialMap = getSocialMessages();
  addedFriends.push({
    name,
    preview: message || '我们已经成为好友，开始聊天吧',
    time: '刚刚'
  });
  socialMap[name] = socialMap[name] || [{ text: message || '你好，很高兴认识你。', type: 'received', time: '刚刚' }];
  saveSocialMessages(socialMap);
  saveChatStorage(CHAT_STORAGE_KEYS.addedFriends, addedFriends);

  if (messageInput) messageInput.value = '';
  if (nameInput) nameInput.value = '';
  closeModal('addFriendModal');
  hydrateAddedFriends();
  showSystemNotification('蜻蜓chat', '已向 ' + name + ' 发送好友请求');
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

// 初始化聊天器
if(document.readyState==='loading') {
  document.addEventListener('DOMContentLoaded', function() {
    initChatFloat();
    window.__acMode = 'agent';
    // 蜻蜓图标状态切换
    const dqImg = document.getElementById('dqImg');
    const redDot = document.getElementById('redDot');
    
    // 来消息：飞+红点 
    window.haveNewMsg = function(){
      setDragonflyUnread(true);
    };
    
    // 无消息：静止+无红点 
    window.noNewMsg = function(){
      setDragonflyUnread(false);
    };
  });
} else {
  initChatFloat();
  window.__acMode = 'agent';
  // 蜻蜓图标状态切换
  const dqImg = document.getElementById('dqImg');
  const redDot = document.getElementById('redDot');
  
  // 来消息：飞+红点 
  window.haveNewMsg = function(){
    setDragonflyUnread(true);
  };
  
  // 无消息：静止+无红点 
  window.noNewMsg = function(){
    setDragonflyUnread(false);
  };
}

// ==================== 聊天广场功能 ====================

// 聊天广场状态
let plazaState = {
  isJoined: false,
  isMuted: false,
  userCount: 0,
  maxUsers: 500,
  messages: []
};

hydratePlazaState();

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

// 模拟广场消息
const plazaMessages = [
  { user: '张会计', content: '大家好，今天增值税申报有什么注意事项吗？', time: '10:30' },
  { user: '李财务', content: '记得检查进项发票是否都认证了', time: '10:32' },
  { user: '王经理', content: '本月的财务报表已经提交了吗？', time: '10:35' },
  { user: '赵总监', content: '请大家注意新的税收政策变化', time: '10:38' },
  { user: '刘专员', content: '电子发票系统今天有点慢', time: '10:40' }
];

// 进入/退出圈子
function togglePlazaJoin() {
  if (plazaState.isJoined) {
    leavePlaza();
  } else {
    joinPlaza();
  }
}

// 进入圈子
function joinPlaza() {
  plazaState.isJoined = true;
  plazaState.userCount = Math.floor(Math.random() * 200) + 100; // 模拟100-300人在线
  persistPlazaState();
  
  // 更新UI
  document.getElementById('plaza-not-joined').style.display = 'none';
  document.getElementById('plaza-chat-area').style.display = 'block';
  document.getElementById('plaza-input-area').style.display = 'block';
  document.getElementById('plaza-join-btn').textContent = '退出圈子';
  document.getElementById('plaza-join-btn').style.backgroundColor = '#e74c3c';
  
  updatePlazaUserCount();
  loadPlazaMessages();
  
  // 显示进入消息
  addPlazaSystemMessage('您已进入同城圈子');
}

// 退出圈子
function leavePlaza() {
  plazaState.isJoined = false;
  plazaState.userCount = 0;
  persistPlazaState();
  
  // 更新UI
  document.getElementById('plaza-not-joined').style.display = 'block';
  document.getElementById('plaza-chat-area').style.display = 'none';
  document.getElementById('plaza-input-area').style.display = 'none';
  document.getElementById('plaza-join-btn').textContent = '进入圈子';
  document.getElementById('plaza-join-btn').style.backgroundColor = '#27ae60';
  
  updatePlazaUserCount();
}

// 切换免打扰模式
function togglePlazaMute() {
  plazaState.isMuted = !plazaState.isMuted;
  persistPlazaState();
  const muteBtn = document.getElementById('plaza-mute-btn');
  
  if (plazaState.isMuted) {
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
  const countElement = document.getElementById('plaza-user-count');
  if (countElement) {
    countElement.textContent = `当前在线: ${plazaState.userCount}/500人`;
  }
}

// 加载广场消息
function loadPlazaMessages() {
  const chatArea = document.getElementById('plaza-chat-area');
  if (!chatArea) return;
  
  chatArea.innerHTML = '';
  
  plazaMessages.forEach(msg => {
    addPlazaMessage(msg.user, msg.content, msg.time, !!msg.isSelf, false);
  });
  
  chatArea.scrollTop = chatArea.scrollHeight;
  if (plazaState.isJoined) {
    setDragonflyUnread(false);
  }
}

// 添加广场消息
function addPlazaMessage(userName, content, time, isSelf = false, persist = true) {
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

  if (persist) {
    plazaMessages.push({ user: userName, content, time, isSelf });
    persistPlazaState();
    if (!plazaState.isJoined || plazaState.isMuted) {
      setDragonflyUnread(true);
    }
  }
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
  persistPlazaState();
}

// 发送广场消息
function sendPlazaMessage() {
  const input = document.getElementById('plaza-message-input');
  if (!input) return;

  const message = input.value.trim();
  if (!message) return;

  if (!plazaState.isJoined) {
    alert('请先进入聊天广场');
    return;
  }

  const now = new Date();
  const time = now.getHours() + ':' + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();

  // 添加自己的消息
  addPlazaMessage('我', message, time, true, true);

  // 清空输入框
  input.value = '';

  // 模拟其他用户回复（随机）
  if (Math.random() > 0.5) {
    setTimeout(() => {
      const randomUser = plazaUsers[Math.floor(Math.random() * plazaUsers.length)];
      const replies = [
        '说得对！',
        '同意您的观点',
        '谢谢分享',
        '我也遇到了同样的问题',
        '有什么好的解决方案吗？',
        '学习了！'
      ];
      const randomReply = replies[Math.floor(Math.random() * replies.length)];
      addPlazaMessage(randomUser.name, randomReply, time, false, true);
    }, 2000 + Math.random() * 3000);
  }
}

// ==================== 圈子系统功能 ====================

let circlesConfig = null;
let currentCircleId = null;
let joinedCircles = {};

const CIRCLES_STORAGE_KEYS = {
  joinedCircles: 'dragonfly_joined_circles_v1',
  circleMessages: 'dragonfly_circle_messages_v1'
};

async function loadCirclesConfig() {
  try {
    const response = await fetch('/circles-config.json');
    if (!response.ok) throw new Error('Failed to load circles config');
    circlesConfig = await response.json();
    initializeCircles();
  } catch (error) {
    console.error('Error loading circles config:', error);
    circlesConfig = { circles: [], categories: [] };
  }
}

function initializeCircles() {
  joinedCircles = loadChatStorage(CIRCLES_STORAGE_KEYS.joinedCircles, {});
  renderCircleCategories();
  renderCirclesList();
}

function renderCircleCategories() {
  const container = document.getElementById('circles-category-tabs');
  if (!container || !circlesConfig) return;

  container.innerHTML = '';

  circlesConfig.categories.forEach(category => {
    const tab = document.createElement('button');
    tab.style.cssText = 'padding: 8px 16px; border: 1px solid #e0e0e0; border-radius: 20px; background: white; cursor: pointer; white-space: nowrap; font-size: 12px; transition: all 0.3s;';
    tab.textContent = category.icon + ' ' + category.name;
    tab.onclick = () => filterCirclesByCategory(category.id, tab);
    container.appendChild(tab);
  });

  if (container.firstChild) {
    container.firstChild.style.borderColor = '#3498db';
    container.firstChild.style.backgroundColor = '#e8f4f8';
    container.firstChild.style.color = '#3498db';
  }
}

function filterCirclesByCategory(categoryId, tabElement) {
  const tabs = document.querySelectorAll('#circles-category-tabs button');
  tabs.forEach(tab => {
    tab.style.borderColor = '#e0e0e0';
    tab.style.backgroundColor = 'white';
    tab.style.color = '';
  });

  tabElement.style.borderColor = '#3498db';
  tabElement.style.backgroundColor = '#e8f4f8';
  tabElement.style.color = '#3498db';

  renderCirclesList(categoryId);
}

function renderCirclesList(categoryId = null) {
  const container = document.getElementById('circles-list-container');
  if (!container || !circlesConfig) return;

  container.innerHTML = '';

  let circles = circlesConfig.circles;
  if (categoryId) {
    circles = circles.filter(c => c.category === categoryId);
  }

  if (circles.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 40px 20px; color: #999;">暂无圈子</div>';
    return;
  }

  circles.forEach(circle => {
    const isJoined = joinedCircles[circle.id];
    const card = document.createElement('div');
    card.style.cssText = 'padding: 12px; border: 1px solid #e0e0e0; border-radius: 6px; cursor: pointer; transition: all 0.3s; background: white;';
    card.onmouseover = () => card.style.backgroundColor = '#f8f9fa';
    card.onmouseout = () => card.style.backgroundColor = 'white';

    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
        <span style="font-size: 24px;">${circle.icon}</span>
        <div style="flex: 1;">
          <div style="font-weight: bold; font-size: 14px; color: #2c3e50;">${circle.name}</div>
          <div style="font-size: 12px; color: #666;">${circle.description}</div>
        </div>
        <button onclick="event.stopPropagation(); viewCircleDetail('${circle.id}')" style="padding: 6px 12px; background-color: ${isJoined ? '#95a5a6' : '#3498db'}; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">${isJoined ? '已加入' : '进入'}</button>
      </div>
      <div style="font-size: 11px; color: #999; display: flex; gap: 8px; flex-wrap: wrap;">
        ${circle.tags.map(tag => `<span style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">${tag}</span>`).join('')}
      </div>
    `;

    card.onclick = () => viewCircleDetail(circle.id);
    container.appendChild(card);
  });
}

function viewCircleDetail(circleId) {
  currentCircleId = circleId;
  const circle = circlesConfig.circles.find(c => c.id === circleId);
  if (!circle) return;

  document.getElementById('circles-list-container').style.display = 'none';
  document.getElementById('circles-category-tabs').style.display = 'none';
  document.getElementById('circle-detail-view').style.display = 'block';

  const isJoined = joinedCircles[circleId];
  document.getElementById('circle-detail-icon').textContent = circle.icon;
  document.getElementById('circle-detail-name').textContent = circle.name;
  document.getElementById('circle-detail-desc').textContent = circle.description;
  document.getElementById('circle-detail-stats').textContent = `最多容纳 ${circle.maxUsers} 人`;

  const joinBtn = document.getElementById('circle-join-btn');
  joinBtn.textContent = isJoined ? '退出圈子' : '加入圈子';
  joinBtn.style.backgroundColor = isJoined ? '#e74c3c' : '#27ae60';

  if (isJoined) {
    document.getElementById('circle-chat-area').style.display = 'block';
    document.getElementById('circle-input-area').style.display = 'block';
    loadCircleMessages(circleId);
  } else {
    document.getElementById('circle-chat-area').style.display = 'none';
    document.getElementById('circle-input-area').style.display = 'none';
  }
}

function backToCirclesList() {
  currentCircleId = null;
  document.getElementById('circle-detail-view').style.display = 'none';
  document.getElementById('circles-list-container').style.display = 'flex';
  document.getElementById('circles-category-tabs').style.display = 'flex';
}

function toggleCircleJoin() {
  if (!currentCircleId) return;

  if (joinedCircles[currentCircleId]) {
    leaveCircle(currentCircleId);
  } else {
    joinCircle(currentCircleId);
  }
}

function joinCircle(circleId) {
  joinedCircles[circleId] = true;
  saveChatStorage(CIRCLES_STORAGE_KEYS.joinedCircles, joinedCircles);
  viewCircleDetail(circleId);
  showSystemNotification('蜻蜓chat', '已加入圈子');
}

function leaveCircle(circleId) {
  delete joinedCircles[circleId];
  saveChatStorage(CIRCLES_STORAGE_KEYS.joinedCircles, joinedCircles);
  backToCirclesList();
  showSystemNotification('蜻蜓chat', '已退出圈子');
}

function loadCircleMessages(circleId) {
  const chatArea = document.getElementById('circle-chat-area');
  if (!chatArea) return;

  chatArea.innerHTML = '';
  const messages = loadChatStorage(CIRCLES_STORAGE_KEYS.circleMessages, {})[circleId] || [];

  messages.forEach(msg => {
    addCircleMessage(msg.user, msg.content, msg.time, msg.isSelf, false);
  });

  chatArea.scrollTop = chatArea.scrollHeight;
}

function addCircleMessage(userName, content, time, isSelf = false, persist = true) {
  const chatArea = document.getElementById('circle-chat-area');
  if (!chatArea) return;

  const messageDiv = document.createElement('div');
  messageDiv.style.cssText = 'margin-bottom: 12px; display: flex; gap: 8px; align-items: flex-start;';

  if (isSelf) {
    messageDiv.style.flexDirection = 'row-reverse';
  }

  messageDiv.innerHTML = `
    <div style="width: 32px; height: 32px; border-radius: 50%; background-color: #3498db; color: white; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; flex-shrink: 0;">${userName[0]}</div>
    <div style="max-width: 70%;">
      <div style="font-size: 12px; color: #666; margin-bottom: 2px;">${userName} ${time}</div>
      <div style="background-color: ${isSelf ? '#3498db' : 'white'}; color: ${isSelf ? 'white' : '#333'}; padding: 8px 12px; border-radius: 12px; font-size: 13px; word-wrap: break-word; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">${content}</div>
    </div>
  `;

  chatArea.appendChild(messageDiv);
  chatArea.scrollTop = chatArea.scrollHeight;

  if (persist) {
    const allMessages = loadChatStorage(CIRCLES_STORAGE_KEYS.circleMessages, {});
    allMessages[currentCircleId] = allMessages[currentCircleId] || [];
    allMessages[currentCircleId].push({ user: userName, content, time, isSelf });
    saveChatStorage(CIRCLES_STORAGE_KEYS.circleMessages, allMessages);
  }
}

function sendCircleMessage() {
  const input = document.getElementById('circle-message-input');
  if (!input || !currentCircleId) return;

  const message = input.value.trim();
  if (!message) return;

  const now = new Date();
  const time = now.getHours() + ':' + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();

  addCircleMessage('我', message, time, true, true);
  input.value = '';

  if (Math.random() > 0.6) {
    setTimeout(() => {
      const users = ['张会计', '李财务', '王经理', '赵总监', '刘专员'];
      const replies = ['说得对！', '同意', '谢谢分享', '学习了！', '有道理'];
      addCircleMessage(users[Math.floor(Math.random() * users.length)], replies[Math.floor(Math.random() * replies.length)], time, false, true);
    }, 1500 + Math.random() * 2000);
  }
}
