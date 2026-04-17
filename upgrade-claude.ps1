# Claude 升级脚本
# 下载并安装最新版本的 Claude

Write-Host "=== Claude 升级工具 ===" -ForegroundColor Green
Write-Host "正在检查系统状态..." -ForegroundColor Cyan

# 检查是否有 Claude 进程在运行
$claudeProcesses = Get-Process | Where-Object { $_.ProcessName -match 'claude' }
if ($claudeProcesses) {
    Write-Host "检测到 Claude 正在运行，正在关闭..." -ForegroundColor Yellow
    $claudeProcesses | Stop-Process -Force
    Start-Sleep -Seconds 3
}

# 定义下载参数
$downloadFolder = $env:TEMP
$installerPath = "$downloadFolder\claude-setup.exe"
$downloadUrl = "https://claude.ai/download"

Write-Host "正在下载最新版本的 Claude..." -ForegroundColor Cyan

# 下载安装程序
try {
    Invoke-WebRequest -Uri $downloadUrl -OutFile $installerPath -ErrorAction Stop
    Write-Host "✅ 下载完成！" -ForegroundColor Green
    
    # 运行安装程序
    Write-Host "正在安装 Claude..." -ForegroundColor Cyan
    Start-Process -FilePath $installerPath -Wait
    
    # 清理临时文件
    Remove-Item $installerPath -Force -ErrorAction SilentlyContinue
    
    Write-Host "🎉 Claude 升级成功！" -ForegroundColor Green
    Write-Host "你现在可以打开 Claude 并享受最新功能了。" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ 升级失败: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "请手动访问 https://claude.ai 下载最新版本。" -ForegroundColor Yellow
}