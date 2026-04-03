#!/bin/bash

# 部署脚本
# 用于将银河星辰财务专用浏览器部署到云服务器

# 服务器配置
SERVER_IP="49.232.63.136"
SERVER_USER="root"
SERVER_DIR="/var/www/yinhexingchen"

# 本地项目目录
LOCAL_DIR="."

# 颜色定义
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

echo -e "${GREEN}=== 银河星辰财务专用浏览器部署脚本 ===${NC}"

echo -e "${YELLOW}1. 连接服务器并创建项目目录...${NC}"
ssh $SERVER_USER@$SERVER_IP "mkdir -p $SERVER_DIR"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 项目目录创建成功${NC}"
else
    echo -e "${RED}✗ 连接服务器失败，请检查IP和用户名${NC}"
    exit 1
fi

echo -e "${YELLOW}2. 上传项目文件...${NC}"
scp -r $LOCAL_DIR/* $SERVER_USER@$SERVER_IP:$SERVER_DIR/

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 项目文件上传成功${NC}"
else
    echo -e "${RED}✗ 文件上传失败${NC}"
    exit 1
fi

echo -e "${YELLOW}3. 安装依赖...${NC}"
ssh $SERVER_USER@$SERVER_IP "cd $SERVER_DIR && npm install"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 依赖安装成功${NC}"
else
    echo -e "${RED}✗ 依赖安装失败${NC}"
    exit 1
fi

echo -e "${YELLOW}4. 启动支付服务器...${NC}"
ssh $SERVER_USER@$SERVER_IP "cd $SERVER_DIR && nohup node server.js > server.log 2>&1 &"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 支付服务器启动成功${NC}"
else
    echo -e "${RED}✗ 支付服务器启动失败${NC}"
    exit 1
fi

echo -e "${YELLOW}5. 配置防火墙...${NC}"
ssh $SERVER_USER@$SERVER_IP "ufw allow 3000/tcp && ufw reload"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 防火墙配置成功${NC}"
else
    echo -e "${YELLOW}⚠ 防火墙配置失败（可能需要手动配置）${NC}"
fi

echo -e "${GREEN}=== 部署完成 ===${NC}"
echo -e "${GREEN}项目已部署到：${NC} https://zonya.work"
echo -e "${GREEN}支付服务器运行在：${NC} http://$SERVER_IP:3000"
echo -e "${YELLOW}请确保：${NC}"
echo -e "1. 域名 zonya.work 已解析到 $SERVER_IP"
echo -e "2. 服务器端口 3000 已开放"
echo -e "3. 微信支付和支付宝回调地址已在对应平台配置"
echo -e "4. 支付配置中的API密钥已设置"
