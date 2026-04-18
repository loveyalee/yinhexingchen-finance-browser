#!/bin/bash
# 自动同步脚本 - 快速更新服务器文件

SERVER_IP="111.230.36.222"
SERVER_USER="root"
REMOTE_PATH="/root/yinhexingchen"

# 要同步的文件列表
FILES=(
  "chat_float.js"
  "circles-config.json"
  "index.html"
  "server.js"
  "xiaoya_service.js"
  "proxy.js"
)

echo "🚀 开始同步文件到服务器..."
echo "服务器: $SERVER_USER@$SERVER_IP"
echo ""

# 同步文件
success_count=0
for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    scp -q "$file" "$SERVER_USER@$SERVER_IP:$REMOTE_PATH/" 2>/dev/null
    if [ $? -eq 0 ]; then
      echo "✓ $file"
      ((success_count++))
    else
      echo "✗ $file"
    fi
  fi
done

echo ""
echo "已上传 $success_count/${#FILES[@]} 个文件"

# 重启服务
echo ""
echo "重启服务..."
ssh $SERVER_USER@$SERVER_IP "cd $REMOTE_PATH && pm2 restart yinhexingchen 2>/dev/null" 2>/dev/null

if [ $? -eq 0 ]; then
  echo "✓ 服务已重启"
  echo ""
  echo "✅ 同步完成！"
  echo "访问地址: https://zonya.work 或 http://111.230.36.222:8080"
else
  echo "⚠️  服务重启可能失败，请检查服务器状态"
fi
