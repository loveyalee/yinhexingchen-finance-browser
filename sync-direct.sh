#!/bin/bash
SERVER_IP="111.230.36.222"
SERVER_USER="root"
REMOTE_PATH="/root/yinhexingchen"

echo "同步文件到服务器..."

FILES=(
  "chat_float.js"
  "circles-config.json"
  "index.html"
  "server.js"
  "xiaoya_service.js"
  "proxy.js"
  "login.html"
  "login.js"
  "register.html"
  "verify.html"
  "cloud_chat.html"
  "invoice_management.html"
  "enterprise_management.html"
  "tax_reporting.html"
  "finance_software.html"
  "finance_jobs.html"
  "member.html"
  "forum.html"
  "paid_qa.html"
  "templates_tools.html"
  "accounting.html"
  "accounting_v2.html"
  "accounting_v2.css"
  "accounting_v2.js"
  "opening_balance_prompt.html"
  "news.html"
  "news_collector.js"
  "smart_assistant.html"
  "yinhelogo.png"
  ".env"
)

# 创建远程目录
ssh $SERVER_USER@$SERVER_IP "mkdir -p $REMOTE_PATH" 2>/dev/null

# 同步文件
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "上传 $file..."
    scp -q "$file" "$SERVER_USER@$SERVER_IP:$REMOTE_PATH/" 2>/dev/null
    if [ $? -eq 0 ]; then
      echo "✓ $file"
    else
      echo "✗ $file 失败"
    fi
  fi
done

echo ""
echo "重启服务..."
ssh $SERVER_USER@$SERVER_IP "cd $REMOTE_PATH && pm2 restart yinhexingchen 2>/dev/null || (pkill -f 'node server.js' 2>/dev/null; sleep 1; nohup node server.js > server.log 2>&1 &)" 2>/dev/null

echo "✓ 同步完成"
