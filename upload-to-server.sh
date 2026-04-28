#!/bin/bash
# 直接上传更新的文件到服务器

SERVER="root@zonya.work"
REMOTE_PATH="/root/yinhexingchen"

echo "准备上传文件到服务器..."

# 上传关键文件
FILES=(
  "chat_float.js"
  "circles-config.json"
  "index.html"
  "server.js"
  "accounting.html"
  "tax_reporting.html"
  "finance_management.html"
  "enterprise_management.html"
  "paid_qa.html"
)

for file in "${FILES[@]}"; do
  echo "上传 $file..."
  scp -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$file" "$SERVER:$REMOTE_PATH/" 2>&1
  if [ $? -eq 0 ]; then
    echo "✓ $file 上传成功"
  else
    echo "✗ $file 上传失败"
  fi
done

echo ""
echo "重启服务器上的应用..."
ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no "$SERVER" "cd $REMOTE_PATH && pm2 restart yinhexingchen 2>/dev/null || node server.js &"

echo "完成！"
