import re

with open('/var/www/yinhexingchen/chat_float.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Add flex layout to AI tab container
content = content.replace(
    '<div id="ai-tab" class="chat-panel-tab-content" style="display: none;">',
    '<div id="ai-tab" class="chat-panel-tab-content" style="display: none; flex-direction: column; height: 100%;">'
)

# Fix 2: Make AI messages area flexible
content = content.replace(
    '<div id="aiChatMessages" style="height:260px;overflow:auto;',
    '<div id="aiChatMessages" style="flex:1;min-height:0;overflow:auto;'
)

# Fix 3: Reduce margins and add flex-shrink to controls
content = content.replace(
    'style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;"',
    'style="flex-shrink:0;display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;"'
)

content = content.replace(
    'style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:12px;"',
    'style="flex-shrink:0;display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:8px;"'
)

content = content.replace(
    'style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;"',
    'style="flex-shrink:0;display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;"'
)

# Fix 4: Input area at bottom, fixed size
content = content.replace(
    'style="display:grid;grid-template-columns:1fr auto;gap:10px;margin-top:12px;"',
    'style="flex-shrink:0;display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end;margin-top:0;"'
)

# Fix 5: Bottom text
content = content.replace(
    'style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;"',
    'style="flex-shrink:0;display:flex;justify-content:space-between;align-items:center;margin-top:8px;"'
)

with open('/var/www/yinhexingchen/chat_float.js', 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed AI tab layout')
