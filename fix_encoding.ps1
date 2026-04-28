# Fix UTF-8 encoding
$ErrorActionPreference = 'Stop'
$filePath = 'E:\yinhexingchen\inventory_management.html'
$content = Get-Content $filePath -Raw -Encoding UTF8
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($filePath, $content, $utf8)
Write-Host 'UTF-8 encoding applied successfully!'
