#!/bin/bash

# Git 自动同步守护进程停止脚本 (Linux/Mac)

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PID_FILE="$SCRIPT_DIR/.git-sync.pid"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  停止 Git 自动同步守护进程${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"

if [ ! -f "$PID_FILE" ]; then
    echo -e "${RED}✗ 没有找到运行的守护进程${NC}"
    exit 1
fi

PID=$(cat "$PID_FILE" 2>/dev/null)

if [ -z "$PID" ]; then
    echo -e "${RED}✗ PID 文件为空${NC}"
    rm -f "$PID_FILE"
    exit 1
fi

# 检查进程是否存在
if ! kill -0 "$PID" 2>/dev/null; then
    echo -e "${YELLOW}⚠ 进程不存在 (PID: $PID)${NC}"
    echo -e "${GREEN}✓ 清理 PID 文件${NC}"
    rm -f "$PID_FILE"
    exit 0
fi

# 停止进程
echo -e "${YELLOW}正在停止进程 (PID: $PID)...${NC}"

kill "$PID" 2>/dev/null
sleep 1

# 验证进程已停止
if kill -0 "$PID" 2>/dev/null; then
    echo -e "${YELLOW}进程仍在运行，强制停止...${NC}"
    kill -9 "$PID" 2>/dev/null
    sleep 1
fi

if ! kill -0 "$PID" 2>/dev/null; then
    echo -e "${GREEN}✓ 进程已停止${NC}"
    rm -f "$PID_FILE"
    echo -e "${GREEN}✓ 清理 PID 文件${NC}"
    echo ""
    echo -e "${GREEN}✅ 守护进程已成功停止${NC}"
else
    echo -e "${RED}✗ 进程仍在运行，可能需要手动停止: kill -9 $PID${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
