$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $projectRoot ".sync-watch.pid"

if (-not (Test-Path -LiteralPath $pidFile -PathType Leaf)) {
    Write-Host "Auto sync is not running."
    exit 0
}

$pidText = (Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
if (-not $pidText) {
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    Write-Host "Removed stale PID file."
    exit 0
}

$process = Get-Process -Id $pidText -ErrorAction SilentlyContinue
if (-not $process) {
    Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
    Write-Host "Auto sync was not running. Removed stale PID file."
    exit 0
}

Stop-Process -Id $pidText -Force
Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue
Write-Host "Auto sync stopped. PID: $pidText"
