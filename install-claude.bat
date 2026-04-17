@echo off
cls
echo === Claude 安装工具 ===
echo 正在检查系统状态...

REM 检查是否有 Claude 进程在运行
taskkill /F /IM claude.exe 2>nul
taskkill /F /IM claude-code.exe 2>nul
echo 正在下载最新版本的 Claude...

REM 下载安装程序
powershell -Command "Invoke-WebRequest -Uri 'https://claude.ai/download' -OutFile '%TEMP%\claude-setup.exe'"

REM 检查下载是否成功
if exist "%TEMP%\claude-setup.exe" (
    echo 下载完成！正在安装 Claude...
    "%TEMP%\claude-setup.exe"
    echo 安装完成！正在清理临时文件...
    del "%TEMP%\claude-setup.exe" /F /Q
    echo 成功！Claude 已更新到最新版本。
) else (
    echo 下载失败，请手动访问 https://claude.ai 下载最新版本。
)

pause