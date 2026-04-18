#!/bin/bash
# 本地测试服务器 - 模拟生产环境

PORT=${1:-8080}
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=========================================="
echo "  蜻蜓Chat 本地测试服务器"
echo "=========================================="
echo ""
echo "项目目录: $PROJECT_DIR"
echo "监听端口: $PORT"
echo ""
echo "访问地址:"
echo "  主页: http://localhost:$PORT/index.html"
echo "  测试: http://localhost:$PORT/test-circles-complete.html"
echo ""
echo "按 Ctrl+C 停止服务器"
echo ""

cd "$PROJECT_DIR"
python3 -m http.server $PORT
