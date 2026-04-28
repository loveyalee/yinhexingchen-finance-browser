# Windsurf Pro 自动安装脚本

Write-Host "========================================"
Write-Host "Windsurf Pro 自动安装脚本"
Write-Host "========================================"
Write-Host ""

# 检查Windsurf是否已安装
$windsurfPath = "E:\Windsurf\Windsurf.exe"
if (Test-Path $windsurfPath) {
    Write-Host "✅ Windsurf 已安装在: E:\Windsurf"
    Write-Host ""
    Write-Host "按任意键启动Windsurf..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    Start-Process $windsurfPath
    exit
}

# 创建下载目录
$downloadPath = "E:\Windsurf-Setup.exe"

Write-Host "📥 正在下载Windsurf Pro..."
Write-Host "请访问: https://windsurf.com/download"
Write-Host ""
Write-Host "下载步骤："
Write-Host "1. 打开浏览器访问上述链接"
Write-Host "2. 点击 'Download for Windows'"
Write-Host "3. 将下载的文件保存为: $downloadPath"
Write-Host "4. 保存完成后，按任意键继续..."
Write-Host ""

$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# 检查文件是否下载成功
if (Test-Path $downloadPath) {
    $fileSize = (Get-Item $downloadPath).Length / 1MB
    Write-Host ""
    Write-Host "✅ 下载完成: $([math]::Round($fileSize, 2)) MB"
    
    Write-Host ""
    Write-Host "🚀 正在安装Windsurf到 E:\Windsurf ..."
    
    # 创建安装目录
    if (-not (Test-Path "E:\Windsurf")) {
        New-Item -ItemType Directory -Path "E:\Windsurf" -Force | Out-Null
    }
    
    # 运行安装程序
    try {
        Start-Process -FilePath $downloadPath -Wait
        Write-Host ""
        Write-Host "✅ Windsurf 安装完成！"
        Write-Host ""
        
        # 清理安装包
        Remove-Item $downloadPath -Force -ErrorAction SilentlyContinue
        Write-Host "🧹 安装包已清理"
        
        Write-Host ""
        Write-Host "🎉 Windsurf Pro 已成功安装到 E:\Windsurf"
        Write-Host ""
        Write-Host "按任意键启动Windsurf..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        
        # 尝试启动Windsurf
        $possiblePaths = @(
            "E:\Windsurf\Windsurf.exe",
            "$env:LOCALAPPDATA\Programs\Windsurf\Windsurf.exe",
            "$env:PROGRAMFILES\Windsurf\Windsurf.exe"
        )
        
        foreach ($path in $possiblePaths) {
            if (Test-Path $path) {
                Start-Process $path
                Write-Host "✅ Windsurf已启动！"
                break
            }
        }
        
    } catch {
        Write-Host "❌ 安装失败: $($_.Exception.Message)"
        Write-Host ""
        Write-Host "请手动运行下载的安装程序: $downloadPath"
    }
} else {
    Write-Host ""
    Write-Host "❌ 未找到安装文件: $downloadPath"
    Write-Host ""
    Write-Host "请重新下载并保存到指定位置"
}

Write-Host ""
Write-Host "按任意键退出..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")