# Git 自动同步守护进程停止脚本

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PidFile = Join-Path $ScriptDir ".git-sync.pid"

Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  停止 Git 自动同步守护进程" -ForegroundColor Yellow
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan

if (-not (Test-Path $PidFile)) {
    Write-Host "✗ 没有找到运行的守护进程" -ForegroundColor Red
    exit 1
}

$Pid = Get-Content $PidFile -ErrorAction SilentlyContinue

if (-not $Pid) {
    Write-Host "✗ PID 文件为空" -ForegroundColor Red
    Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue
    exit 1
}

# 检查进程是否存在
$Process = Get-Process -Id $Pid -ErrorAction SilentlyContinue

if (-not $Process) {
    Write-Host "⚠ 进程不存在 (PID: $Pid)" -ForegroundColor Yellow
    Write-Host "✓ 清理 PID 文件" -ForegroundColor Green
    Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue
    exit 0
}

# 停止进程
Write-Host "正在停止进程 (PID: $Pid)..." -ForegroundColor Yellow

try {
    Stop-Process -Id $Pid -Force
    Start-Sleep -Seconds 1

    # 验证进程已停止
    if (-not (Get-Process -Id $Pid -ErrorAction SilentlyContinue)) {
        Write-Host "✓ 进程已停止" -ForegroundColor Green

        # 删除PID文件
        Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue
        Write-Host "✓ 清理 PID 文件" -ForegroundColor Green

        Write-Host ""
        Write-Host "✅ 守护进程已成功停止" -ForegroundColor Green
    } else {
        Write-Host "✗ 进程仍在运行，可能需要强制停止" -ForegroundColor Red
    }
} catch {
    Write-Host "✗ 停止进程失败: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
