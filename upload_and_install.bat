@echo off

echo === Uploading project files and installing dependencies ===

echo 1. Checking if PuTTY is installed...
if not exist "C:\Program Files\PuTTY\pscp.exe" (
    echo PuTTY is not installed. Please download and install PuTTY first.
    echo Download URL: https://www.putty.org/
    pause
    exit 1
)

echo 2. Uploading project files...
"C:\Program Files\PuTTY\pscp.exe" -r -pw 3452572Ab! * root@111.230.36.222:/var/www/yinhexingchen/

echo 3. Installing dependencies...
"C:\Program Files\PuTTY\plink.exe" -ssh -l root -pw 3452572Ab! 111.230.36.222 "cd /var/www/yinhexingchen && npm install"

echo === Operation completed ===
echo Project files uploaded to: /var/www/yinhexingchen
echo Dependencies installed successfully
pause
