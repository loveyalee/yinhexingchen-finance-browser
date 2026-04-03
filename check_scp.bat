@echo off

REM 检查scp命令是否存在

echo 检查scp命令是否存在...

echo scp命令路径:
where scp.exe

if %errorlevel% equ 0 (
    echo scp命令存在
) else (
    echo scp命令不存在
    echo 请安装OpenSSH客户端
    echo 下载地址: https://github.com/PowerShell/Win32-OpenSSH/releases
)

echo.
echo 检查系统PATH环境变量:
echo %PATH%
echo.
echo 按任意键退出...
pause