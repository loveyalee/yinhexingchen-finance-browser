@echo off

echo === 银河星辰财务专用浏览器部署脚本 ===

echo 1. 连接服务器并创建项目目录...
ssh -o StrictHostKeyChecking=no root@111.230.36.222 "mkdir -p /var/www/yinhexingchen"

echo 2. 上传项目文件...
scp -o StrictHostKeyChecking=no -r * root@111.230.36.222:/var/www/yinhexingchen/

echo 3. 安装依赖...
ssh -o StrictHostKeyChecking=no root@111.230.36.222 "cd /var/www/yinhexingchen && npm install"

echo 4. 启动支付服务器...
ssh -o StrictHostKeyChecking=no root@111.230.36.222 "cd /var/www/yinhexingchen && nohup node server.js > server.log 2>&1 &"

echo === 部署完成 ===
echo 项目已部署到：https://zonya.work
echo 支付服务器运行在：http://111.230.36.222:3000
