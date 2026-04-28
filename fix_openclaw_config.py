import json
import os

# 读取配置文件
config_path = os.path.join(os.environ['USERPROFILE'], '.openclaw', 'openclaw.json')

with open(config_path, 'r', encoding='utf-8') as f:
    config = json.load(f)

# 移除 openclaw-weixin 相关配置
if 'channels' in config and 'openclaw-weixin' in config['channels']:
    del config['channels']['openclaw-weixin']
    print('Removed openclaw-weixin from channels')

if 'plugins' in config:
    if 'allow' in config['plugins'] and 'openclaw-weixin' in config['plugins']['allow']:
        config['plugins']['allow'].remove('openclaw-weixin')
        print('Removed openclaw-weixin from plugins.allow')
    
    if 'entries' in config['plugins'] and 'openclaw-weixin' in config['plugins']['entries']:
        del config['plugins']['entries']['openclaw-weixin']
        print('Removed openclaw-weixin from plugins.entries')

# 保存配置文件
with open(config_path, 'w', encoding='utf-8') as f:
    json.dump(config, f, indent=2, ensure_ascii=False)

print('Config file updated successfully!')
