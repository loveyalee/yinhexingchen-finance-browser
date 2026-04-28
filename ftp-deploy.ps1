# FTP部署脚本

$ftpServer = "111.230.36.222"
$ftpUsername = "root"
$ftpPassword = "你的密码"
$localFile = "E:\yinhexingchen\index.html"
$remoteFile = "/var/www/yinhexingchen/index.html"

# 创建FTP请求
$ftpRequest = [System.Net.FtpWebRequest]::Create("ftp://$ftpServer$remoteFile")
$ftpRequest.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
$ftpRequest.Credentials = New-Object System.Net.NetworkCredential($ftpUsername, $ftpPassword)
$ftpRequest.UseBinary = $true
$ftpRequest.UsePassive = $true

# 读取本地文件
$fileStream = [System.IO.File]::OpenRead($localFile)
$ftpStream = $ftpRequest.GetRequestStream()

# 上传文件
$buffer = New-Object byte[] 10240
$read = 0

while (($read = $fileStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
    $ftpStream.Write($buffer, 0, $read)
    $totalRead += $read
    $percentage = [math]::Round(($totalRead / $fileStream.Length) * 100, 2)
    Write-Progress -Activity "上传文件" -Status "$percentage% 完成" -PercentComplete $percentage
}

# 清理
$fileStream.Close()
$ftpStream.Close()

Write-Host "文件上传完成！"