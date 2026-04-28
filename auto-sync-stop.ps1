# 停止自动同步
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $scriptPath ".auto-sync.pid"

if (Test-Path $pidFile) {
    $pid = Get-Content $pidFile -ErrorAction SilentlyContinue
    if ($pid) {
        $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($process) {
            Stop-Process -Id $pid -Force
            Write-Host "自动同步已停止 (PID: $pid)" -ForegroundColor Green
        } else {
            Write-Host "进程已不存在" -ForegroundColor Yellow
        }
    }
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
} else {
    Write-Host "自动同步未运行" -ForegroundColor Yellow
}