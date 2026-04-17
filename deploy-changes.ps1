#!/usr/bin/env powershell

# 部署修改的文件到远程服务器

$remoteServer = "root@111.230.36.222"
$remoteDir = "/var/www/yinhexingchen"
$localDir = "."

# 要上传的修改文件列表
$modifiedFiles = @(
    "inventory_management.html",
    "index.html",
    "member.html",
    "accounting_v2.html",
    "accounting_v2.js",
    "finance_software.html",
    "admin.html",
    "server.js",
    "user_menu.js",
    ".env"
)

Write-Host "========================================" -ForegroundColor Green
Write-Host "  Yinhexingchen - Deploy Changes       " -ForegroundColor Green
Write-Host "  Server: $remoteServer" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

# 检查SSH连接
Write-Host "[1/3] Check SSH connectivity" -ForegroundColor Cyan
try {
    ssh $remoteServer "echo SSH connection test" | Out-Null
    Write-Host "✓ SSH connection successful" -ForegroundColor Green
} catch {
    Write-Host "✗ SSH connection failed: $_" -ForegroundColor Red
    exit 1
}

# 上传修改的文件
Write-Host "[2/3] Upload modified files" -ForegroundColor Cyan
foreach ($file in $modifiedFiles) {
    $localPath = Join-Path $localDir $file
    if (Test-Path $localPath) {
        Write-Host "Uploading $file"
        $remotePath = "$remoteServer`:$remoteDir/"
        scp "$localPath" "$remotePath"
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ $file uploaded successfully" -ForegroundColor Green
        } else {
            Write-Host "✗ Failed to upload $file" -ForegroundColor Red
        }
    } else {
        Write-Host "✗ $file not found" -ForegroundColor Yellow
    }
}

# 完成部署
Write-Host "[3/3] Deployment completed" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Green
Write-Host "Modified files have been uploaded to the server." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green