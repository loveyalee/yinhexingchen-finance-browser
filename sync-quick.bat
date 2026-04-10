@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

echo ========================================
echo   Galaxy Stars - Quick Sync
echo   Usage: sync-quick.bat filename
echo ========================================
echo.

set SERVER=root@111.230.36.222
set PROJECT_DIR=/home/yinhexingchen

if "%~1"=="" (
    echo [Error] Please specify a file
    echo Usage: sync-quick.bat filename
    dir /b *.html *.js *.json 2>nul
    pause
    exit /b 1
)

set FILE=%~1

if not exist "%FILE%" (
    echo [Error] File not found: %FILE%
    pause
    exit /b 1
)

echo Syncing: %FILE% -^> %SERVER%:%PROJECT_DIR%/
scp -o StrictHostKeyChecking=no %FILE% %SERVER%:%PROJECT_DIR%/

if errorlevel 1 (
    echo [Failed] Sync error
    pause
    exit /b 1
)

echo [Success] %FILE% synced

if /i "%FILE%"=="server.js" (
    echo Detected server.js change, restarting service...
    ssh %SERVER% "cd %PROJECT_DIR% && pm2 restart yinhexingchen"
    echo Service restarted
)

echo.
pause
