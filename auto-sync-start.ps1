# 启动自动同步
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $scriptPath ".auto-sync.pid"

if (Test-Path $pidFile) {
    $existingPid = Get-Content $pidFile -ErrorAction SilentlyContinue
    if ($existingPid) {
        $process = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "自动同步已在运行中 (PID: $existingPid)" -ForegroundColor Yellow
            Write-Host "如需重启，请先运行 .\auto-sync-stop.ps1" -ForegroundColor Yellow
            exit 0
        }
    }
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
}

Write-Host "启动自动同步..." -ForegroundColor Green
Write-Host "功能: 文件修改后自动同步到 GitHub 和服务器" -ForegroundColor Cyan

$targetScript = Join-Path $scriptPath "auto-sync.ps1"
Start-Process powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$targetScript`"" -WindowStyle Hidden

Start-Sleep -Seconds 2

if (Test-Path $pidFile) {
    $pid = Get-Content $pidFile
    Write-Host "自动同步已启动 (PID: $pid)" -ForegroundColor Green
    Write-Host "日志文件: $scriptPath\auto-sync.log" -ForegroundColor Cyan
} else {
    Write-Host "启动失败，请检查 auto-sync.log" -ForegroundColor Red
}
