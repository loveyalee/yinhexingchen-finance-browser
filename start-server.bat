@echo off

REM 启动支付服务器

echo ================================================
echo 银河星辰支付服务器启动脚本
echo ================================================

REM 检查Node.js是否安装
node --version
if %errorlevel% neq 0 (
    echo 错误：未找到Node.js，请先安装Node.js 14.0.0或更高版本
    echo 下载地址：https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js已安装，版本：
node --version

echo.
echo 正在启动支付服务器...
echo 服务地址：http://localhost:3000
echo ================================================

REM 启动服务器
node server.js

REM 等待用户按键
pause
