# 同步修复后的客服相关HTML文件到服务器
# 2026-04-26

$SERVER_IP = "111.230.36.222"
$SERVER_USER = "root"
$SERVER_DIR = "/root/yinhexingchen"

$files = @(
    "finance_management.html",
    "news.html",
    "contract_management.html",
    "seal_management.html",
    "expense_reimbursement.html"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "同步客服修复文件到服务器" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$failed = 0

foreach ($file in $files) {
    $localPath = "E:\yinhexingchen\$file"
    if (Test-Path $localPath) {
        Write-Host "上传 $file..." -NoNewline
        try {
            $result = scp -o ConnectTimeout=10 "$localPath" "$SERVER_USER@$SERVER_IP`:$SERVER_DIR/$file" 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-Host " ✓" -ForegroundColor Green
            } else {
                Write-Host " ✗ ($result)" -ForegroundColor Red
                $failed++
            }
        } catch {
            Write-Host " ✗ ($_)" -ForegroundColor Red
            $failed++
        }
    } else {
        Write-Host "$file 不存在，跳过" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "重启服务..." -NoNewline
ssh -o ConnectTimeout=10 "$SERVER_USER@$SERVER_IP" "cd $SERVER_DIR && pm2 restart yinhexingchen 2>/dev/null || (pkill -f 'node server.js' 2>/dev/null; sleep 1; nohup node server.js > server.log 2>&1 &)" 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host " ✓" -ForegroundColor Green
} else {
    Write-Host " ✗" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($failed -eq 0) {
    Write-Host "同步完成！" -ForegroundColor Green
    Write-Host "访问 https://zonya.work 查看效果" -ForegroundColor Cyan
} else {
    Write-Host "有 $failed 个文件同步失败，请检查" -ForegroundColor Yellow
}
Write-Host "========================================" -ForegroundColor Cyan
