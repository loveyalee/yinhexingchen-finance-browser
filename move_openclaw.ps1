# 移动 openclaw 到 E 盘根目录
$source = "E:\yinhexingchen\openclaw"
$destination = "E:\openclaw"

# 确保目标目录存在
if (-not (Test-Path $destination)) {
    New-Item -Path $destination -ItemType Directory -Force
}

# 复制所有文件和文件夹
Copy-Item -Path "$source\*" -Destination $destination -Recurse -Force

# 验证复制是否成功
if (Test-Path "$destination\openclaw.json") {
    Write-Host "OpenClaw 已成功复制到 E:\openclaw!"
    
    # 清理源文件夹
    Remove-Item -Path $source -Recurse -Force
    Write-Host "已清理临时文件夹 E:\yinhexingchen\openclaw"
} else {
    Write-Host "复制失败，请检查权限!"
}
