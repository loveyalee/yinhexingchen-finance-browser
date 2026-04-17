# 支付服务部署脚本
# 请在PowerShell中运行此脚本

$server = "111.230.36.222"
$user = "root"
$remotePath = "/root/yinhexingchen/server"

Write-Host "=================================" -ForegroundColor Cyan
Write-Host "银河星辰支付服务部署脚本" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否安装了Posh-SSH模块
if (!(Get-Module -ListAvailable -Name Posh-SSH)) {
    Write-Host "[提示] 正在安装 Posh-SSH 模块..." -ForegroundColor Yellow
    Install-Module -Name Posh-SSH -Force -Scope CurrentUser
}

# 获取密码
$password = Read-Host "请输入服务器密码"

# 创建凭据
$secPassword = ConvertTo-SecureString $password -AsPlainText -Force
$credential = New-Object System.Management.Automation.PSCredential($user, $secPassword)

# 建立SSH会话
Write-Host "[提示] 正在连接服务器..." -ForegroundColor Yellow
try {
    $session = New-SSHSession -ComputerName $server -Credential $credential -ErrorAction Stop
    Write-Host "[成功] SSH连接成功!" -ForegroundColor Green
} catch {
    Write-Host "[错误] SSH连接失败: $_" -ForegroundColor Red
    exit 1
}

# 创建远程目录
Write-Host "[提示] 创建远程目录..." -ForegroundColor Yellow
Invoke-SSHCommand -SessionId $session.SessionId -Command "mkdir -p $remotePath"

# 上传文件
$localFiles = @(
    "package.json",
    "server.js",
    "alipay-service.js",
    ".env",
    "start.bat",
    "README.md"
)

Write-Host "[提示] 上传文件中..." -ForegroundColor Yellow
foreach ($file in $localFiles) {
    $localPath = Join-Path $PSScriptRoot $file
    if (Test-Path $localPath) {
        Set-SCPItem -ComputerName $server -Credential $credential -Path $localPath -Destination "$remotePath/$file"
        Write-Host "  - $file 上传成功" -ForegroundColor Green
    } else {
        Write-Host "  - $file 不存在，跳过" -ForegroundColor Yellow
    }
}

# 安装依赖并启动服务
Write-Host "[提示] 安装依赖并启动服务..." -ForegroundColor Yellow
$commands = @(
    "cd $remotePath",
    "npm install",
    "pm2 delete payment-service 2>/dev/null || true",
    "pm2 start server.js --name payment-service",
    "pm2 save"
)

foreach ($cmd in $commands) {
    $result = Invoke-SSHCommand -SessionId $session.SessionId -Command $cmd
    Write-Host $result.Output
}

# 关闭会话
Remove-SSHSession -SessionId $session.SessionId

Write-Host ""
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "部署完成!" -ForegroundColor Green
Write-Host "服务地址: http://$server`:3000" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
