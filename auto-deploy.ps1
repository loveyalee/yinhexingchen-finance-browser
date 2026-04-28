# 自动部署脚本 - 监控文件变化并自动上传

$ftpServer = "111.230.36.222"
$ftpUsername = "root"
$ftpPassword = "你的密码"
$localDirectory = "E:\yinhexingchen"
$remoteDirectory = "/var/www/yinhexingchen"

# 要监控的文件
$filesToMonitor = @(
    "index.html",
    "member.html",
    "admin.html",
    "enterprise_management.html",
    "inventory_management.html",
    "finance_jobs.html",
    "templates_tools.html",
    "finance_academy.html"
)

Write-Host "====================================="
Write-Host "银河星辰自动部署脚本"
Write-Host "监控目录: $localDirectory"
Write-Host "部署服务器: $ftpServer"
Write-Host "监控文件:"
foreach ($file in $filesToMonitor) {
    Write-Host "  - $file"
}
Write-Host "====================================="
Write-Host "开始监控文件变化..."
Write-Host "按 Ctrl+C 停止监控"
Write-Host "====================================="

# 创建文件系统监视器
$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $localDirectory
$watcher.Filter = "*.html"
$watcher.IncludeSubdirectories = $false
$watcher.EnableRaisingEvents = $true

# 定义事件处理函数
$action = {
    $path = $Event.SourceEventArgs.FullPath
    $changeType = $Event.SourceEventArgs.ChangeType
    $fileName = [System.IO.Path]::GetFileName($path)
    
    # 只处理我们关心的文件
    if ($filesToMonitor -contains $fileName) {
        Write-Host ""
        Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $fileName 发生变化 ($changeType)"
        
        # 上传文件
        try {
            Write-Host "正在上传 $fileName 到服务器..."
            $remotePath = "$remoteDirectory/$fileName"
            $scpCommand = "scp -o StrictHostKeyChecking=no \"$path\" $ftpUsername@$ftpServer:\"$remotePath\""
            Invoke-Expression $scpCommand
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✅ $fileName 上传成功！"
            } else {
                Write-Host "❌ $fileName 上传失败！"
            }
        } catch {
            Write-Host "❌ 上传错误: $($_.Exception.Message)"
        }
    }
}

# 注册事件
Register-ObjectEvent $watcher "Changed" -Action $action
Register-ObjectEvent $watcher "Created" -Action $action

# 保持脚本运行
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    # 清理
    Unregister-Event -SourceIdentifier "FileSystemWatcher_Changed"
    Unregister-Event -SourceIdentifier "FileSystemWatcher_Created"
    $watcher.Dispose()
    Write-Host "监控已停止"
}