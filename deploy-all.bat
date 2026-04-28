@echo off

echo === 银河星辰自动部署脚本 ===
echo 上传所有HTML文件到服务器...

echo 1. 上传 index.html
scp -o StrictHostKeyChecking=no index.html root@111.230.36.222:/var/www/yinhexingchen/

echo 2. 上传 member.html
scp -o StrictHostKeyChecking=no member.html root@111.230.36.222:/var/www/yinhexingchen/

echo 3. 上传 admin.html
scp -o StrictHostKeyChecking=no admin.html root@111.230.36.222:/var/www/yinhexingchen/

echo 4. 上传 enterprise_management.html
scp -o StrictHostKeyChecking=no enterprise_management.html root@111.230.36.222:/var/www/yinhexingchen/

echo 5. 上传 inventory_management.html
scp -o StrictHostKeyChecking=no inventory_management.html root@111.230.36.222:/var/www/yinhexingchen/

echo 6. 上传 finance_jobs.html
scp -o StrictHostKeyChecking=no finance_jobs.html root@111.230.36.222:/var/www/yinhexingchen/

echo 7. 上传 templates_tools.html
scp -o StrictHostKeyChecking=no templates_tools.html root@111.230.36.222:/var/www/yinhexingchen/

echo 8. 上传 finance_academy.html
scp -o StrictHostKeyChecking=no finance_academy.html root@111.230.36.222:/var/www/yinhexingchen/

echo === 部署完成 ===
echo 所有HTML文件已上传到 https://zonya.work
echo.  
echo 按任意键退出...
pause >nul