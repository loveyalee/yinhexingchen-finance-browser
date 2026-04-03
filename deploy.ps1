# 部署脚本 (PowerShell版本)
# 用于将银河星辰财务专用浏览器部署到云服务器

# 服务器配置
$SERVER_IP = "49.232.63.136"
$SERVER_USER = "root"
$SERVER_DIR = "/var/www/yinhexingchen"

# 本地项目目录
$LOCAL_DIR = "."

Write-Host "=== 银河星辰财务专用浏览器部署脚本 ===" -ForegroundColor Green

Write-Host "1. 连接服务器并创建项目目录..." -ForegroundColor Yellow
try {
    $sshCommand = "ssh $SERVER_USER@$SERVER_IP 'mkdir -p $SERVER_DIR'"
    Invoke-Expression $sshCommand
    Write-Host "✓ 项目目录创建成功" -ForegroundColor Green
} catch {
    Write-Host "✗ 连接服务器失败，请检查IP和用户名" -ForegroundColor Red
    exit 1
}

Write-Host "2. 上传项目文件..." -ForegroundColor Yellow
try {
    # 使用scp上传文件
    $scpCommand = "scp -r $LOCAL_DIR\* $SERVER_USER@${SERVER_IP}:${SERVER_DIR}/"
    Invoke-Expression $scpCommand
    Write-Host "✓ 项目文件上传成功" -ForegroundColor Green
} catch {
    Write-Host "✗ 文件上传失败" -ForegroundColor Red
    exit 1
}

Write-Host "3. 安装依赖..." -ForegroundColor Yellow
try {
    $npmCommand = "ssh $SERVER_USER@${SERVER_IP} 'cd ${SERVER_DIR} && npm install'"
    Invoke-Expression $npmCommand
    Write-Host "✓ 依赖安装成功" -ForegroundColor Green
} catch {
    Write-Host "✗ 依赖安装失败" -ForegroundColor Red
    exit 1
}

Write-Host "4. 启动支付服务器..." -ForegroundColor Yellow
try {
    $startCommand = "ssh $SERVER_USER@${SERVER_IP} 'cd ${SERVER_DIR} && nohup node server.js > server.log 2>&1 &'"
    Invoke-Expression $startCommand
    Write-Host "✓ 支付服务器启动成功" -ForegroundColor Green
} catch {
    Write-Host "✗ 支付服务器启动失败" -ForegroundColor Red
    exit 1
}

Write-Host "5. 配置防火墙..." -ForegroundColor Yellow
try {
    $firewallCommand = "ssh $SERVER_USER@${SERVER_IP} 'ufw allow 3000/tcp && ufw reload'"
    Invoke-Expression $firewallCommand
    Write-Host "✓ 防火墙配置成功" -ForegroundColor Green
} catch {
    Write-Host "⚠ 防火墙配置失败（可能需要手动配置）" -ForegroundColor Yellow
}

Write-Host "=== 部署完成 ===" -ForegroundColor Green
Write-Host "项目已部署到：https://zonya.work" -ForegroundColor Green
Write-Host "支付服务器运行在：http://${SERVER_IP}:3000" -ForegroundColor Green
Write-Host "请确保：" -ForegroundColor Yellow
Write-Host "1. 域名 zonya.work 已解析到 ${SERVER_IP}"
Write-Host "2. 服务器端口 3000 已开放"
Write-Host "3. 微信支付和支付宝回调地址已在对应平台配置"
Write-Host "4. 支付配置中的API密钥已设置"
