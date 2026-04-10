@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

echo ========================================
echo   银河星辰 - 一键部署到生产环境
echo   服务器: 111.230.36.222
echo ========================================
echo.

set SERVER=root@111.230.36.222
set PROJECT_DIR=/var/www/yinhexingchen

echo [1/6] 测试SSH连接...
ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 %SERVER% "echo 连接成功" 2>nul
if errorlevel 1 (
    echo [错误] 无法连接到服务器，请检查网络或密码
    pause
    exit /b 1
)
echo.

echo [2/6] 创建项目目录并上传代码...
ssh %SERVER% "mkdir -p %PROJECT_DIR%/db"
echo 正在上传文件（排除node_modules和db）...
scp -o StrictHostKeyChecking=no -r ^
    server.js ^
    package.json ^
    package-lock.json ^
    *.html ^
    *.js ^
    *.bat ^
    *.ps1 ^
    *.conf ^
    %SERVER%:%PROJECT_DIR%/
echo 文件上传完成
echo.

echo [3/6] 上传nginx配置...
scp nginx-config.conf %SERVER%:/tmp/yinhexingchen-nginx.conf
ssh %SERVER% "cp /tmp/yinhexingchen-nginx.conf /etc/nginx/conf.d/yinhexingchen.conf 2>/dev/null || cp /tmp/yinhexingchen-nginx.conf /etc/nginx/sites-available/yinhexingchen.conf 2>/dev/null; nginx -t && nginx -s reload && echo 'nginx配置已更新' || echo 'nginx配置未更改'"
echo.

echo [4/6] 安装服务器依赖...
ssh %SERVER% "cd %PROJECT_DIR% && npm install --production 2>&1 | tail -5"
echo.

echo [5/6] 启动/重启服务（使用PM2）...
ssh %SERVER% "cd %PROJECT_DIR% && (pm2 describe yinhexingchen > /dev/null 2>&1 && (pm2 restart yinhexingchen && echo '服务已重启') || (pm2 start server.js --name yinhexingchen && pm2 save && echo '服务已启动')) && pm2 status"
echo.

echo [6/6] 验证部署...
ssh %SERVER% "curl -s -o /dev/null -w 'HTTP状态: %%{http_code}\n' http://localhost:3001/ || echo '服务未响应'"
echo.

echo ========================================
echo   部署完成！
echo   网站地址: https://zonya.work
echo   服务器目录: %PROJECT_DIR%
echo ========================================
pause
