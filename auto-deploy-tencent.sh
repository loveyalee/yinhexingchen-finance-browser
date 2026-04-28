#!/bin/bash
# 自动部署脚本：上传到腾讯云服务器并重启

SERVER="111.230.36.222"
SERVER_PATH="/var/www/yinhexingchen"
USER="root"

# 要上传的核心文件
CORE_FILES=(
    "server.js"
    "user_menu.js"
    "login.js"
    "chat_float.js"
    "xiaoya_service.js"
)

echo "========================================"
echo "  自动部署到腾讯云服务器"
echo "========================================"

# 检查是否有参数传入（指定文件）
if [ $# -gt 0 ]; then
    FILES="$@"
else
    # 默认上传核心文件
    FILES="${CORE_FILES[*]}"
fi

echo "上传文件: $FILES"
echo ""

# 上传文件
for file in $FILES; do
    if [ -f "$file" ]; then
        echo "上传 $file ..."
        scp -o ConnectTimeout=30 "$file" "$USER@$SERVER:$SERVER_PATH/"
        if [ $? -eq 0 ]; then
            echo "  ✓ $file 上传成功"
        else
            echo "  ✗ $file 上传失败"
        fi
    else
        echo "  ! $file 文件不存在，跳过"
    fi
done

echo ""
echo "重启应用..."
ssh -o ConnectTimeout=30 "$USER@$SERVER" "pm2 restart yinhexingchen"

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================"
    echo "  ✓ 部署完成！"
    echo "========================================"
else
    echo ""
    echo "✗ 重启失败，请手动检查"
fi
