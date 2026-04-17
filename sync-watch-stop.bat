@echo off
chcp 65001 >nul 2>&1
setlocal

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-watch-stop.ps1"
exit /b %ERRORLEVEL%
