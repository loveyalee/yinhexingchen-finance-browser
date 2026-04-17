@echo off
chcp 65001 >nul
echo ===================================
echo 银河星辰支付服务启动脚本
echo ===================================
echo.

cd /d "%~dp0"

echo 正在检查 Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未安装 Node.js，请先安装 Node.js
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

echo 正在检查依赖...
if not exist "node_modules" (
    echo [提示] 首次运行，正在安装依赖...
    npm install
    if errorlevel 1 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
)

echo.
echo 启动支付服务...
echo ===================================
npm start
