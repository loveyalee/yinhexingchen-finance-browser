$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$server = "root@111.230.36.222"
$remoteReleaseDir = "/var/www/yinhexingchen/releases"
$localReleaseDir = Join-Path $projectRoot "release"
$requiredFiles = @(
    "yinhexingchen-1.0.0.exe",
    "yinhexingchen-1.0.0.exe.blockmap",
    "latest.yml"
)

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host $Message -ForegroundColor Cyan
}

Write-Host "========================================"
Write-Host "  Yinhexingchen - Desktop Release Deploy"
Write-Host "  Server: $server"
Write-Host "========================================"

if (-not (Test-Path -LiteralPath $localReleaseDir -PathType Container)) {
    throw "Release directory not found: $localReleaseDir"
}

foreach ($name in $requiredFiles) {
    $path = Join-Path $localReleaseDir $name
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Missing release file: $path"
    }
}

Write-Step "[1/4] Check SSH connectivity"
& ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 $server "echo connected" | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Unable to connect to server $server"
}

Write-Step "[2/4] Prepare remote releases directory"
& ssh -o StrictHostKeyChecking=no $server "mkdir -p '$remoteReleaseDir'" | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Failed to prepare remote directory: $remoteReleaseDir"
}

Write-Step "[3/4] Upload desktop release files"
foreach ($name in $requiredFiles) {
    $path = Join-Path $localReleaseDir $name
    Write-Host "Uploading release/$name"
    & scp -o StrictHostKeyChecking=no $path "${server}:$remoteReleaseDir/$name" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Upload failed: release/$name"
    }
}

Write-Step "[4/4] Verify remote release URLs"
& ssh -o StrictHostKeyChecking=no $server "curl -I -s https://zonya.work/releases/latest.yml | head -n 1 && curl -I -s https://zonya.work/releases/yinhexingchen-1.0.0.exe | head -n 1"
if ($LASTEXITCODE -ne 0) {
    throw "Remote release verification failed"
}

Write-Host ""
Write-Host "Desktop release deployed successfully." -ForegroundColor Green
Write-Host "Installer: https://zonya.work/releases/yinhexingchen-1.0.0.exe" -ForegroundColor Green
Write-Host "Update feed: https://zonya.work/releases/latest.yml" -ForegroundColor Green
