# 查看自动同步状态
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $scriptPath ".auto-sync.pid"
$logFile = Join-Path $scriptPath "auto-sync.log"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "银河星辰 - 自动同步状态" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if (Test-Path $pidFile) {
    $pid = Get-Content $pidFile -ErrorAction SilentlyContinue
    if ($pid) {
        $process = Get-Process -Id $pid -ErrorAction SilentlyContinue
        if ($process) {
            Write-Host "状态: 运行中" -ForegroundColor Green
            Write-Host "PID: $pid" -ForegroundColor White
            Write-Host "运行时间: $($process.StartTime)" -ForegroundColor White
        } else {
            Write-Host "状态: 已停止 (进程不存在)" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "状态: 未运行" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "最近日志:" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Gray

if (Test-Path $logFile) {
    Get-Content $logFile -Tail 15 -Encoding UTF8
} else {
    Write-Host "暂无日志" -ForegroundColor Gray
}