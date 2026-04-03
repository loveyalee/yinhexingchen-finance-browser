# Upload files and install dependencies script
Write-Host "=== Uploading project files and installing dependencies ===" -ForegroundColor Green

# Server information
$serverIP = "49.232.63.136"
$serverUser = "root"
$serverDir = "/var/www/yinhexingchen"

# Step 1: Upload project files
Write-Host "1. Uploading project files..." -ForegroundColor Yellow
$command = "scp -o StrictHostKeyChecking=no -r * $serverUser@${serverIP}:${serverDir}/"
Write-Host "Executing: $command"
Write-Host "Please enter server password: 3452572Ab!"
Invoke-Expression $command

# Step 2: Install dependencies
Write-Host "2. Installing dependencies..." -ForegroundColor Yellow
$command = "ssh -o StrictHostKeyChecking=no $serverUser@$serverIP 'cd $serverDir && npm install'"
Write-Host "Executing: $command"
Write-Host "Please enter server password: 3452572Ab!"
Invoke-Expression $command

Write-Host "=== Operation completed ===" -ForegroundColor Green
Write-Host "Project files uploaded to: $serverDir" -ForegroundColor Green
Write-Host "Dependencies installed successfully" -ForegroundColor Green
