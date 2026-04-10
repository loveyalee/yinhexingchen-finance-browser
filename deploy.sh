#!/bin/bash
# 银河星辰平台 - 服务器首次部署脚本
# 在服务器上执行：bash deploy.sh

GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}  银河星辰平台部署脚本${NC}"
echo -e "${GREEN}=====================================${NC}"

PROJECT_DIR="/home/yinhexingchen"

# 1. 安装 Node.js（如未安装）
echo -e "${YELLOW}[1/5] 检查 Node.js 环境...${NC}"
if ! command -v node &> /dev/null; then
  echo -e "${YELLOW}安装 Node.js 18...${NC}"
  curl -fsSL https://rpm.nodesource.com/setup_18.x | bash - 2>/dev/null || \
  curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  apt-get install -y nodejs 2>/dev/null || yum install -y nodejs
else
  echo -e "${GREEN}Node.js 已安装: $(node -v)${NC}"
fi

# 2. 安装 PM2（如未安装）
echo -e "${YELLOW}[2/5] 检查 PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
  echo -e "${YELLOW}安装 PM2...${NC}"
  npm install -g pm2
else
  echo -e "${GREEN}PM2 已安装: $(pm2 -v)${NC}"
fi

# 3. 创建项目目录
echo -e "${YELLOW}[3/5] 准备项目目录...${NC}"
mkdir -p $PROJECT_DIR
echo -e "${GREEN}项目目录: $PROJECT_DIR${NC}"

# 4. 安装依赖
echo -e "${YELLOW}[4/5] 安装项目依赖...${NC}"
cd $PROJECT_DIR
if [ -f "package.json" ]; then
  npm install --production
  echo -e "${GREEN}依赖安装完成${NC}"
else
  echo -e "${RED}未找到 package.json，请先上传代码${NC}"
  exit 1
fi

# 5. 启动/重启服务
echo -e "${YELLOW}[5/5] 启动服务...${NC}"
pm2 describe yinhexingchen > /dev/null 2>&1
if [ $? -eq 0 ]; then
  pm2 restart yinhexingchen
  echo -e "${GREEN}服务已重启${NC}"
else
  pm2 start server.js --name yinhexingchen
  pm2 save
  pm2 startup 2>/dev/null | tail -1 | bash 2>/dev/null || true
  echo -e "${GREEN}服务已启动并设置开机自启${NC}"
fi

pm2 status

echo -e "${GREEN}=====================================${NC}"
echo -e "${GREEN}  部署完成！${NC}"
echo -e "${GREEN}  访问地址: https://zonya.work${NC}"
echo -e "${GREEN}  支付页面: https://zonya.work/payment.html${NC}"
echo -e "${GREEN}=====================================${NC}"
