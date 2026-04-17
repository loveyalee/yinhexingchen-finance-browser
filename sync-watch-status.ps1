$ErrorActionPreference = "Stop"

# Reports whether the background auto-sync watcher is alive.
# Used by the batch wrapper for quick health checks.
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $projectRoot ".sync-watch.pid"
$logFile = Join-Path $projectRoot "sync-watch.log"

if (-not (Test-Path -LiteralPath $pidFile -PathType Leaf)) {
    Write-Host "Auto sync is not running."
    exit 1
}

$pidText = (Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
if (-not $pidText) {
    Write-Host "Auto sync is not running. PID file is empty."
    exit 1
}

$process = Get-Process -Id $pidText -ErrorAction SilentlyContinue
if (-not $process) {
    Write-Host "Auto sync is not running. Stale PID file: $pidText"
    exit 1
}

Write-Host "Auto sync is running. PID: $pidText"
Write-Host "Log file: $logFile"
