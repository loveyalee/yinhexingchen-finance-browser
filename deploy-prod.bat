@echo off
chcp 65001 >nul 2>&1
setlocal

echo ========================================
echo   银河星辰 - 一键部署到生产环境
echo   服务器: 111.230.36.222
echo ========================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-prod.ps1"
set EXIT_CODE=%ERRORLEVEL%
if not "%EXIT_CODE%"=="0" (
    echo.
    echo 部署失败，错误码: %EXIT_CODE%
    pause
    exit /b %EXIT_CODE%
)

echo.
echo 部署完成。
pause
