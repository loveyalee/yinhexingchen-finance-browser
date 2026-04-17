$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $projectRoot ".sync-watch.pid"
$logFile = Join-Path $projectRoot "sync-watch.log"
$workerScript = Join-Path $projectRoot "sync-watch.ps1"

function Get-RunningWatcherPid {
    if (-not (Test-Path -LiteralPath $pidFile -PathType Leaf)) {
        return $null
    }

    $pidText = (Get-Content -LiteralPath $pidFile -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
    if (-not $pidText) {
        return $null
    }

    $process = Get-Process -Id $pidText -ErrorAction SilentlyContinue
    if ($process) {
        return [int]$pidText
    }

    return $null
}

Write-Host "========================================"
Write-Host "  Yinhexingchen - Auto Sync"
Write-Host "========================================"
Write-Host ""

$runningPid = Get-RunningWatcherPid
if ($runningPid) {
    Write-Host "Auto sync is already running. PID: $runningPid"
    Write-Host "Log file: $logFile"
    exit 0
}

$process = Start-Process powershell `
    -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $workerScript) `
    -WorkingDirectory $projectRoot `
    -WindowStyle Minimized `
    -PassThru

Start-Sleep -Seconds 2

$runningPid = Get-RunningWatcherPid
if ($runningPid) {
    Write-Host "Auto sync started. PID: $runningPid"
    Write-Host "Log file: $logFile"
    exit 0
}

if ($process -and -not $process.HasExited) {
    Write-Host "Auto sync started. PID: $($process.Id)"
    Write-Host "Log file: $logFile"
    exit 0
}

throw "Failed to start auto sync watcher."
