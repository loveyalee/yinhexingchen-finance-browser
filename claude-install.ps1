# Claude Code 安装和升级脚本
# 此脚本会下载并安装最新版本的 Claude

Write-Host "开始升级 Claude Code..." -ForegroundColor Green

# 定义下载和安装路径
$downloadPath = "$env:TEMP\claude-setup.exe"
$installUrl = "https://claude.ai/download/latest"

# 检查是否有旧版本
$existingClaude = Get-Process | Where-Object { $_.ProcessName -like "claude*" }
if ($existingClaude) {
    Write-Host "检测到 Claude 正在运行，正在关闭..." -ForegroundColor Yellow
    $existingClaude | Stop-Process -Force
    Start-Sleep -Seconds 2
}

# 下载最新版本
Write-Host "正在下载最新版本的 Claude..." -ForegroundColor Cyan

try {
    Invoke-WebRequest -Uri $installUrl -OutFile $downloadPath -ErrorAction Stop
    Write-Host "下载完成！" -ForegroundColor Green
    
    # 运行安装程序
    Write-Host "正在安装 Claude..." -ForegroundColor Cyan
    Start-Process -FilePath $downloadPath -ArgumentList "/S" -Wait
    
    # 清理临时文件
    Remove-Item $downloadPath -Force -ErrorAction SilentlyContinue
    
    Write-Host "Claude Code 升级完成！" -ForegroundColor Green
    Write-Host "你现在可以打开 Claude 并开始使用了。" -ForegroundColor Cyan
} catch {
    Write-Host "升级失败: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "请检查网络连接或手动访问 https://claude.ai 下载最新版本。" -ForegroundColor Yellow
}