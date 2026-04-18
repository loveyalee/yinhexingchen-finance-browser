# Git 自动同步守护进程启动脚本
# 功能: 监视本地文件变更，自动提交和推送到GitHub

param(
    [switch]$Background = $false,
    [switch]$Debug = $false
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DaemonScript = Join-Path $ScriptDir "git-sync-daemon.js"
$PidFile = Join-Path $ScriptDir ".git-sync.pid"

Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Git 自动同步守护进程" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan

# 检查Node.js
Write-Host "✓ 检查 Node.js..." -ForegroundColor Yellow
try {
    $NodeVersion = node --version
    Write-Host "  Node.js 版本: $NodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ 未找到 Node.js，请先安装" -ForegroundColor Red
    exit 1
}

# 检查git仓库
Write-Host "✓ 检查 Git 仓库..." -ForegroundColor Yellow
try {
    $GitStatus = git rev-parse --git-dir 2>$null
    Write-Host "  Git 仓库: $(Get-Item -Path (git rev-parse --show-toplevel) -ErrorAction Stop)" -ForegroundColor Green
} catch {
    Write-Host "  ✗ 当前不在 Git 仓库目录中" -ForegroundColor Red
    exit 1
}

# 检查是否已运行
if (Test-Path $PidFile) {
    $OldPid = Get-Content $PidFile -ErrorAction SilentlyContinue
    if ($OldPid -and (Get-Process -Id $OldPid -ErrorAction SilentlyContinue)) {
        Write-Host "  ⚠ 守护进程已在运行 (PID: $OldPid)" -ForegroundColor Yellow
        Write-Host "  请先运行 stop-git-sync.ps1 停止它" -ForegroundColor Yellow
        exit 1
    }
}

# 启动daemon
Write-Host "`n✓ 启动守护进程..." -ForegroundColor Yellow

if ($Background) {
    # 后台运行
    Write-Host "  模式: 后台运行" -ForegroundColor Green

    $ProcessInfo = New-Object System.Diagnostics.ProcessStartInfo
    $ProcessInfo.FileName = "node"
    $ProcessInfo.Arguments = $DaemonScript
    $ProcessInfo.UseShellExecute = $false
    $ProcessInfo.RedirectStandardOutput = $true
    $ProcessInfo.RedirectStandardError = $true
    $ProcessInfo.CreateNoWindow = $true
    $ProcessInfo.WorkingDirectory = $ScriptDir

    $Process = [System.Diagnostics.Process]::Start($ProcessInfo)

    # 保存PID
    $Process.Id | Out-File -FilePath $PidFile -Encoding ASCII -NoNewline

    Write-Host "  PID: $($Process.Id)" -ForegroundColor Green
    Write-Host "  日志文件: $(Join-Path $ScriptDir '.git-sync.log')" -ForegroundColor Green

    # 设置输出重定向到日志文件
    $Process.StandardOutput | Out-File -FilePath (Join-Path $ScriptDir ".git-sync.log") -Append
    $Process.StandardError | Out-File -FilePath (Join-Path $ScriptDir ".git-sync.err") -Append

    Write-Host "`n✅ 守护进程已启动" -ForegroundColor Green
} else {
    # 前台运行
    Write-Host "  模式: 前台运行 (按 Ctrl+C 停止)" -ForegroundColor Green
    Write-Host ""

    node $DaemonScript
}

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  提示:" -ForegroundColor Yellow
Write-Host "  - 守护进程将自动监视文件变更" -ForegroundColor Gray
Write-Host "  - 检测到改动时自动提交到本地仓库" -ForegroundColor Gray
Write-Host "  - 每 30 秒推送一次到 GitHub" -ForegroundColor Gray
Write-Host "  - 使用 stop-git-sync.ps1 停止守护进程" -ForegroundColor Gray
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
