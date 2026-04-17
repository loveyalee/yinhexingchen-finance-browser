@echo off
chcp 65001 >nul
echo =================================
echo 银河星辰支付服务部署脚本
echo =================================
echo.
echo 服务器: 111.230.36.222
echo 用户名: root
echo.
echo 请输入密码后按回车:
set /p password=

echo.
echo [提示] 正在上传文件...
echo.

REM 使用pscp上传文件（需要安装PuTTY）
REM 如果没有pscp，请使用其他SFTP工具如WinSCP、FileZilla

echo =================================
echo 请使用以下方式之一上传文件:
echo.
echo 方式1: 使用WinSCP
echo   下载地址: https://winscp.net/
echo   连接信息:
echo     主机: 111.230.36.222
echo     用户名: root
echo     密码: %password%
echo     上传目录: /root/yinhexingchen/server
echo.
echo 方式2: 使用Git Bash
echo   在Git Bash中执行:
echo   scp -r server/* root@111.230.36.222:/root/yinhexingchen/server/
echo.
echo 方式3: 使用PowerShell
echo   运行 deploy.ps1
echo =================================
pause
