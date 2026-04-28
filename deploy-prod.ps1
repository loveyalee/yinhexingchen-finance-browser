$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$server = "root@111.230.36.222"
$projectDir = "/var/www/yinhexingchen"
$excludeDirectories = @(".git", "node_modules", "db", ".idea", ".vscode", "hermes-agent-test", ".claude", "openclaw")
$excludeFiles = @(
    "id_rsa_zonya",
    "server_log.txt"
)
$excludePatterns = @(
    "tmp_*",
    "*.backup-*"
)
$uploadExtensions = @(
    ".html", ".css", ".js", ".json", ".conf", ".md",
    ".ps1", ".bat", ".sh", ".png", ".jpg", ".jpeg",
    ".svg", ".ico", ".txt"
)
$alwaysInclude = @(
    "server.js",
    "package.json",
    "package-lock.json"
)

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host $Message -ForegroundColor Cyan
}

function Get-RelativePathCompat {
    param(
        [string]$BasePath,
        [string]$TargetPath
    )

    $baseResolved = (Resolve-Path -LiteralPath $BasePath).Path
    $targetResolved = (Resolve-Path -LiteralPath $TargetPath).Path

    if ($targetResolved.StartsWith($baseResolved, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $targetResolved.Substring($baseResolved.Length).TrimStart('\', '/')
    }

    $baseUri = New-Object System.Uri(($baseResolved.TrimEnd('\') + '\'))
    $targetUri = New-Object System.Uri($targetResolved)
    return [System.Uri]::UnescapeDataString($baseUri.MakeRelativeUri($targetUri).ToString()).Replace('/', '\')
}

function Test-ShouldSkipFile {
    param([System.IO.FileInfo]$File)

    foreach ($excluded in $excludeDirectories) {
        $segment = [IO.Path]::DirectorySeparatorChar + $excluded + [IO.Path]::DirectorySeparatorChar
        if ($File.FullName.Contains($segment)) {
            return $true
        }
    }

    if ($excludeFiles -contains $File.Name) {
        return $true
    }

    foreach ($pattern in $excludePatterns) {
        if ($File.Name -like $pattern) {
            return $true
        }
    }

    if ($alwaysInclude -contains $File.Name) {
        return $false
    }

    return $uploadExtensions -notcontains $File.Extension.ToLowerInvariant()
}

function Get-UploadFiles {
    Get-ChildItem -LiteralPath $projectRoot -Recurse -File | Where-Object {
        -not (Test-ShouldSkipFile $_)
    } | Sort-Object FullName
}

function Sync-File {
    param([System.IO.FileInfo]$File)

    $relativePath = Get-RelativePathCompat -BasePath $projectRoot -TargetPath $File.FullName
    $normalizedRelativePath = $relativePath -replace "\\", "/"
    $remotePath = "$projectDir/$normalizedRelativePath"
    $remoteDir = [System.IO.Path]::GetDirectoryName($remotePath).Replace("\", "/")

    & ssh -o StrictHostKeyChecking=no $server "mkdir -p '$remoteDir'" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create remote directory: $remoteDir"
    }

    Write-Host "Uploading $normalizedRelativePath"
    & scp -o StrictHostKeyChecking=no $File.FullName "${server}:$remotePath" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Upload failed: $normalizedRelativePath"
    }
}

Write-Host "========================================"
Write-Host "  Yinhexingchen - Production Deploy"
Write-Host "  Server: $server"
Write-Host "========================================"

Write-Step "[1/6] Check SSH connectivity"
& ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 $server "echo connected" | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Unable to connect to server $server"
}

Write-Step "[2/6] Prepare remote directory"
& ssh -o StrictHostKeyChecking=no $server "mkdir -p '$projectDir'" | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Failed to create remote directory: $projectDir"
}

Write-Step "[3/6] Upload project files"
$files = @(Get-UploadFiles)
if (-not $files.Count) {
    throw "No files selected for upload"
}
foreach ($file in $files) {
    Sync-File -File $file
}

if (Test-Path -LiteralPath (Join-Path $projectRoot "nginx-config.conf") -PathType Leaf) {
    Write-Step "[4/6] Update nginx config"
    & scp -o StrictHostKeyChecking=no (Join-Path $projectRoot "nginx-config.conf") "${server}:/tmp/yinhexingchen-nginx.conf" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to upload nginx config"
    }
    & ssh -o StrictHostKeyChecking=no $server "cp /tmp/yinhexingchen-nginx.conf /etc/nginx/conf.d/yinhexingchen.conf 2>/dev/null || cp /tmp/yinhexingchen-nginx.conf /etc/nginx/sites-available/yinhexingchen.conf 2>/dev/null; nginx -t >/tmp/yinhexingchen-nginx-test.log 2>&1 && nginx -s reload" | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "nginx config was not applied. Check /tmp/yinhexingchen-nginx-test.log on the server."
    }
} else {
    Write-Step "[4/6] Skip nginx config"
}

Write-Step "[5/6] Install dependencies and restart PM2"
& ssh -o StrictHostKeyChecking=no $server "cd '$projectDir' && npm install --production && (pm2 describe yinhexingchen > /dev/null 2>&1 && pm2 restart yinhexingchen --update-env || (pm2 start server.js --name yinhexingchen && pm2 save))" | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Dependency install or PM2 restart failed"
}

Write-Step "[6/6] Verify live site"
& ssh -o StrictHostKeyChecking=no $server "curl -I -s https://zonya.work/ | head -n 1"
if ($LASTEXITCODE -ne 0) {
    throw "Live site verification failed"
}

Write-Host ""
Write-Host "Deploy complete: https://zonya.work" -ForegroundColor Green
