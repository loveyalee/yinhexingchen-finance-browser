#!/usr/bin/env python3
import re

with open('/var/www/yinhexingchen/smart_assistant.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix first-screen-shell - make it a proper flex layout
old_first_screen = '''        <div class="first-screen-shell">
          <div id="topKpiStrip" class="top-kpi-strip"></div>
          <div id="homeFocusPanel" class="home-focus-panel"></div>
          <div class="workspace-summary-row">
            <div class="card">
              <h3>首屏经营总览</h3>
              <div id="workspaceFeed" class="workspace-feed"></div>
            </div>
            <div class="card">
              <h3>首屏 AI 快捷操作</h3>
              <div id="aiShortcutPanel" class="shortcut-deck"></div>
            </div>
          </div>
        </div>'''

new_first_screen = '''        <div class="first-screen-shell">
          <div id="topKpiStrip" class="top-kpi-strip"></div>
          <div id="homeFocusPanel" class="home-focus-panel"></div>
          <div class="workspace-summary-row">
            <div class="card overview-card">
              <h3>首屏经营总览</h3>
              <div id="workspaceFeed" class="workspace-feed"></div>
            </div>
            <div class="card shortcut-card">
              <h3>首屏 AI 快捷操作</h3>
              <div id="aiShortcutPanel" class="shortcut-deck"></div>
            </div>
          </div>
        </div>'''

content = content.replace(old_first_screen, new_first_screen)

# 2. Fix main layout - make chat always visible at bottom
old_assistant_shell = '''        <div class="assistant-shell">
          <div class="chat-panel">
            <div class="chat-header">
              <div class="assistant-panel-eyebrow">AI 财务 Copilot 工作区</div>
              <h2>蜻蜓智能财务助手</h2>
              <p>左侧用于连续对话、生成分析、承接角色工作流；右侧聚合经营、风险、任务与财务业务工作台。</p>
            </div>
            <div class="chat-messages" id="chatMessages">
              <div class="message assistant">
                <div class="message-content">
                  您好！我是您的蜻蜓智能财务助手，有什么可以帮您的吗？
                </div>
                <div class="message-time">10:00</div>
              </div>
            </div>
            <div class="chat-input">
              <input type="text" id="chatInput" placeholder="输入问题或指令...">
              <button class="voice-btn" id="voiceBtn" title="语音输入">🎤</button>
              <button class="btn btn-primary" onclick="sendMessage()">发送</button>
            </div>
          </div>
          
          <div class="sidebar-panel">'''

new_assistant_shell = '''        <div class="assistant-shell">
          <div class="sidebar-panel">'''

content = content.replace(old_assistant_shell, new_assistant_shell)

# 3. Fix chat-panel CSS
old_chat_panel_css = '''    .chat-panel {
      flex: 1;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      display: flex;
      flex-direction: column;
      min-height: 400px;
      height: calc(100vh - 180px);
      overflow: hidden;
    }'''

new_chat_panel_css = '''    .chat-panel {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: min(900px, 95%);
      background-color: white;
      border-radius: 18px 18px 0 0;
      box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.12);
      display: flex;
      flex-direction: column;
      height: 520px;
      overflow: hidden;
      z-index: 100;
    }'''

content = content.replace(old_chat_panel_css, new_chat_panel_css)

# 4. Fix chat-input to be sticky at bottom
old_chat_input = '''    .chat-input {
      padding: 15px;
      border-top: 1px solid #e0e0e0;
      display: flex;
      gap: 10px;
      align-items: center;
      background: #fff;
      flex-shrink: 0;
      position: sticky;
      bottom: 0;
      z-index: 2;
      box-shadow: 0 -6px 18px rgba(16, 38, 65, 0.08);
    }'''

new_chat_input = '''    .chat-input {
      padding: 12px 16px;
      border-top: 1px solid #e0e0e0;
      display: flex;
      gap: 10px;
      align-items: center;
      background: #fff;
      flex-shrink: 0;
      box-shadow: 0 -4px 16px rgba(16, 38, 65, 0.08);
    }'''

content = content.replace(old_chat_input, new_chat_input)

# 5. Fix sidebar-panel layout
old_sidebar_css = '''    .sidebar-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }'''

new_sidebar_css = '''    .sidebar-panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-bottom: 550px; /* Space for fixed chat panel */
    }'''

content = content.replace(old_sidebar_css, new_sidebar_css)

# 6. Fix assistant-shell CSS
old_assistant_css = '''    .assistant-shell {
      display: grid;
      grid-template-columns: minmax(0, 1.18fr) minmax(320px, 0.82fr);
      gap: 18px;
      align-items: start;
      margin-bottom: 18px;
    }'''

new_assistant_css = '''    .assistant-shell {
      display: grid;
      grid-template-columns: 1fr;
      gap: 12px;
      margin-bottom: 12px;
    }'''

content = content.replace(old_assistant_css, new_assistant_css)

# 7. Add new CSS for fixed chat panel
css_marker = '    .assistant-container {'
new_css = '''    .chat-panel-standalone {
      position: fixed;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: min(900px, 95%);
      background: linear-gradient(180deg, #ffffff, #fbfdff);
      border-radius: 18px 18px 0 0;
      box-shadow: 0 -6px 28px rgba(15, 38, 64, 0.14);
      display: flex;
      flex-direction: column;
      height: 480px;
      overflow: hidden;
      z-index: 100;
    }

    .chat-header-fixed {
      padding: 14px 18px 10px;
      background: linear-gradient(180deg, #f9fbfe, #eef5fd);
      border-bottom: 1px solid rgba(26, 101, 184, 0.08);
      flex-shrink: 0;
    }

    .chat-header-fixed h2 {
      font-size: 16px;
      color: #1a2d42;
      margin: 0 0 4px 0;
    }

    .chat-header-fixed p {
      font-size: 12px;
      color: #5f7590;
      margin: 0;
      line-height: 1.5;
    }

    .chat-messages-fixed {
      flex: 1;
      padding: 16px 20px;
      overflow-y: auto;
      background: #fff;
    }

    .chat-input-fixed {
      padding: 12px 16px;
      border-top: 1px solid #e8eef5;
      display: flex;
      gap: 10px;
      align-items: center;
      background: #fff;
      flex-shrink: 0;
    }

    .chat-input-fixed input {
      flex: 1;
      height: 42px;
      padding: 0 16px;
      border: 2px solid #8fb8e3;
      border-radius: 20px;
      outline: none;
      font-size: 14px;
    }

    .workspace-feed {
      max-height: 180px;
      overflow-y: auto;
    }

    .overview-card {
      min-height: 160px;
    }

    .shortcut-card {
      min-height: 160px;
    }

    .workspace-summary-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

'''
content = content.replace(css_marker, new_css + css_marker)

# 8. Fix content-area to have proper padding for fixed chat
old_content_area = '''    .content-area {
      flex: 1;
      padding: 18px 20px;
      overflow-y: auto;
    }'''

new_content_area = '''    .content-area {
      flex: 1;
      padding: 18px 20px 520px;
      overflow-y: auto;
    }'''

content = content.replace(old_content_area, new_content_area)

# 9. Fix main-content height
old_main = '''    .main-content {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      height: 100vh;
    }'''

new_main = '''    .main-content {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      height: 100vh;
      overflow: hidden;
    }'''

content = content.replace(old_main, new_main)

with open('/var/www/yinhexingchen/smart_assistant.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('Layout fixed successfully')
