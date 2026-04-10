@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

echo ========================================
echo   银河星辰 - 实时同步开发工具
echo   本地修改 → 自动同步到服务器
echo   服务器: 111.230.36.222
echo ========================================
echo.

set SERVER=root@111.230.36.222
set PROJECT_DIR=/home/yinhexingchen

echo 正在启动实时同步...
echo 按 Ctrl+C 停止同步
echo.

:SYNC_LOOP
echo [%date% %time%] 检测文件变更并同步...

REM 同步所有关键文件
scp -o StrictHostKeyChecking=no -q ^
    server.js ^
    package.json ^
    %SERVER%:%PROJECT_DIR%/ 2>nul

scp -o StrictHostKeyChecking=no -q ^
    *.html ^
    %SERVER%:%PROJECT_DIR%/ 2>nul

scp -o StrictHostKeyChecking=no -q ^
    *.js ^
    %SERVER%:%PROJECT_DIR%/ 2>nul

scp -o StrictHostKeyChecking=no -q ^
    nginx-config.conf ^
    %SERVER%:%PROJECT_DIR%/ 2>nul

REM 如果server.js有变化则重启服务
ssh %SERVER% "cd %PROJECT_DIR% && pm2 restart yinhexingchen --update-env 2>/dev/null" 2>nul

echo [%date% %time%] 同步完成，等待下次检测...
timeout /t 10 /nobreak >nul
goto SYNC_LOOP
