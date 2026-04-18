#!/bin/bash

# Git 自动同步守护进程启动脚本 (Linux/Mac)
# 功能: 监视本地文件变更，自动提交和推送到GitHub

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DAEMON_SCRIPT="$SCRIPT_DIR/git-sync-daemon.js"
PID_FILE="$SCRIPT_DIR/.git-sync.pid"
LOG_FILE="$SCRIPT_DIR/.git-sync.log"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Git 自动同步守护进程${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"

# 检查Node.js
echo -e "${YELLOW}✓ 检查 Node.js...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}  ✗ 未找到 Node.js，请先安装${NC}"
    exit 1
fi

NODE_VERSION=$(node --version)
echo -e "${GREEN}  Node.js 版本: $NODE_VERSION${NC}"

# 检查git仓库
echo -e "${YELLOW}✓ 检查 Git 仓库...${NC}"
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}  ✗ 当前不在 Git 仓库目录中${NC}"
    exit 1
fi

GIT_DIR=$(git rev-parse --show-toplevel)
echo -e "${GREEN}  Git 仓库: $GIT_DIR${NC}"

# 检查是否已运行
if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE" 2>/dev/null)
    if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then
        echo -e "${YELLOW}  ⚠ 守护进程已在运行 (PID: $OLD_PID)${NC}"
        echo -e "${YELLOW}  请先运行 stop-git-sync.sh 停止它${NC}"
        exit 1
    fi
fi

# 启动daemon
echo -e "\n${YELLOW}✓ 启动守护进程...${NC}"
echo -e "${GREEN}  模式: 后台运行${NC}"

# 在后台启动Node.js脚本
nohup node "$DAEMON_SCRIPT" >> "$LOG_FILE" 2>&1 &
PID=$!

# 保存PID
echo -n "$PID" > "$PID_FILE"

echo -e "${GREEN}  PID: $PID${NC}"
echo -e "${GREEN}  日志文件: $LOG_FILE${NC}"

sleep 1

# 验证进程是否启动成功
if kill -0 "$PID" 2>/dev/null; then
    echo -e "\n${GREEN}✅ 守护进程已启动${NC}"
    echo ""
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  提示:${NC}"
    echo -e "${BLUE}  - 守护进程将自动监视文件变更${NC}"
    echo -e "${BLUE}  - 检测到改动时自动提交到本地仓库${NC}"
    echo -e "${BLUE}  - 每 30 秒推送一次到 GitHub${NC}"
    echo -e "${BLUE}  - 使用 stop-git-sync.sh 停止守护进程${NC}"
    echo -e "${BLUE}  - 查看日志: tail -f $LOG_FILE${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
else
    echo -e "${RED}✗ 守护进程启动失败${NC}"
    rm -f "$PID_FILE"
    exit 1
fi
