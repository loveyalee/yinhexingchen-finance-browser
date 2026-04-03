@echo off

REM Check if scp is available

echo Checking scp command...

echo Looking for scp.exe:
where scp.exe

if %errorlevel% equ 0 (
    echo scp command found
) else (
    echo scp command not found
    echo Please install OpenSSH client
    echo Download: https://github.com/PowerShell/Win32-OpenSSH/releases
)

echo.
echo System PATH:
echo %PATH%
echo.
echo Manual sync instructions:
echo 1. Open Command Prompt
echo 2. Navigate to project directory:
echo    cd c:\Users\Administrator\Documents\trae_projects\yinhexingchen
echo 3. Run scp commands:
echo    scp -o StrictHostKeyChecking=no *.html root@49.232.63.136:/var/www/yinhexingchen/
echo    scp -o StrictHostKeyChecking=no *.js root@49.232.63.136:/var/www/yinhexingchen/
echo    scp -o StrictHostKeyChecking=no *.json root@49.232.63.136:/var/www/yinhexingchen/
echo    scp -o StrictHostKeyChecking=no *.png root@49.232.63.136:/var/www/yinhexingchen/
echo 4. Enter password: 3452572Ab!
echo.
echo Press any key to exit...
pause