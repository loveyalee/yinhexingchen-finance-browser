@echo off
cd /d E:\yinhexingchen
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File E:\yinhexingchen\auto-sync.ps1' -WindowStyle Hidden"
echo Auto-sync started...
ping -n 4 127.0.0.1 > nul
if exist .auto-sync.pid (
    echo PID:
    type .auto-sync.pid
) else (
    echo Check auto-sync.log for errors
)
pause