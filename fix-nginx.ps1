# 修复 Nginx 配置脚本
$serverIp = "111.230.36.222"
$password = "3452572Ab!"

# Nginx 配置内容
$config = @'
server {
    listen 80;
    server_name zonya.work;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name zonya.work;

    ssl_certificate /etc/letsencrypt/live/zonya.work/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/zonya.work/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
'@

# 将配置写入临时文件
$config | Out-File -FilePath "nginx-config-temp.conf" -Encoding UTF8

# 使用 scp 上传配置
Write-Host "正在上传 Nginx 配置..."
$scpCommand = "scp nginx-config-temp.conf root@${serverIp}:/etc/nginx/sites-available/zonya.work"
Invoke-Expression $scpCommand

# 测试并重载 Nginx
Write-Host "正在测试并重载 Nginx..."
$sshCommand = "ssh root@${serverIp} 'nginx -t && systemctl reload nginx'"
Invoke-Expression $sshCommand

Write-Host "修复完成！"
