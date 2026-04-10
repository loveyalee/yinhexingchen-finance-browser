@echo off
chcp 65001 >nul 2>&1
setlocal

echo ========================================
echo   银河星辰 - GitHub提交并自动部署
echo ========================================
echo.

set MSG=%*
if "%MSG%"=="" set MSG=chore: auto sync local changes

echo [1/3] 添加变更到Git...
git add .
if errorlevel 1 goto :fail

echo [2/3] 提交到本地仓库...
git commit -m "%MSG%"
if errorlevel 1 (
  echo 可能没有新的可提交内容，继续尝试推送...
)

echo [3/3] 推送到 GitHub master...
git push origin master
if errorlevel 1 goto :fail

echo.
echo 已推送到 GitHub。
echo 如果 GitHub Actions secrets 配置完成，将自动同步到服务器并重启服务。
pause
exit /b 0

:fail
echo.
echo 操作失败，请检查 Git 登录状态、远程仓库权限与网络连接。
pause
exit /b 1
