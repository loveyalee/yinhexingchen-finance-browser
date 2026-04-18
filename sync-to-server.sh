#!/bin/bash
# 直接同步文件到服务器（不通过GitHub）

SERVER_IP="111.230.36.222"
SERVER_USER="root"
REMOTE_PATH="/root/yinhexingchen"
LOCAL_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================="
echo "  直接同步文件到服务器"
echo "=========================================="
echo ""
echo "本地路径: $LOCAL_PATH"
echo "服务器: $SERVER_USER@$SERVER_IP:$REMOTE_PATH"
echo ""

# 检查SSH连接
echo "检查SSH连接..."
ssh -o ConnectTimeout=5 -o BatchMode=yes $SERVER_USER@$SERVER_IP "echo '✓ SSH连接成功'" 2>/dev/null
if [ $? -ne 0 ]; then
  echo "✗ SSH连接失败，请检查："
  echo "  1. 服务器是否在线"
  echo "  2. SSH密钥是否正确配置"
  echo "  3. 防火墙是否允许SSH访问"
  exit 1
fi

echo ""
echo "准备同步的文件："
FILES=(
  "chat_float.js"
  "circles-config.json"
  "index.html"
  "server.js"
  "xiaoya_service.js"
  "proxy.js"
)

# 显示要同步的文件
for file in "${FILES[@]}"; do
  if [ -f "$LOCAL_PATH/$file" ]; then
    size=$(ls -lh "$LOCAL_PATH/$file" | awk '{print $5}')
    echo "  ✓ $file ($size)"
  else
    echo "  ✗ $file (不存在)"
  fi
done

echo ""
read -p "确认同步？(y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "已取消"
  exit 1
fi

echo ""
echo "开始同步..."

# 创建远程目录
ssh $SERVER_USER@$SERVER_IP "mkdir -p $REMOTE_PATH" 2>/dev/null

# 同步文件
for file in "${FILES[@]}"; do
  if [ -f "$LOCAL_PATH/$file" ]; then
    echo -n "上传 $file... "
    scp -q "$LOCAL_PATH/$file" "$SERVER_USER@$SERVER_IP:$REMOTE_PATH/" 2>/dev/null
    if [ $? -eq 0 ]; then
      echo "✓"
    else
      echo "✗"
    fi
  fi
done

echo ""
echo "重启服务..."
ssh $SERVER_USER@$SERVER_IP "cd $REMOTE_PATH && pm2 restart yinhexingchen 2>/dev/null || (pkill -f 'node server.js' 2>/dev/null; sleep 1; nohup node server.js > server.log 2>&1 &)" 2>/dev/null

echo ""
echo "=========================================="
echo "  同步完成！"
echo "=========================================="
echo ""
echo "验证部署："
echo "  访问: https://zonya.work"
echo "  或: http://111.230.36.222:8080"
echo ""
