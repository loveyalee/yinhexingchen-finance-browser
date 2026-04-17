# 部署和运维指南

## 快速开始

### 前置条件
- Node.js 14+
- MySQL 5.7+（仅用于备份还原，主库在阿里云）
- SSH 客户端（用于连接备份服务器）
- 可选: Docker/Docker Compose

### 1. 环境配置

#### 步骤1：更新 .env 文件

```bash
# 复制示例配置
cp .env.example .env

# 编辑 .env，填入实际的值
nano .env
```

**关键配置项**:
```env
# 阿里云 RDS
MYSQL_HOST=yinhexingchen.cxhxc.rds.aliyuncs.com
MYSQL_USER=admin
MYSQL_PASSWORD=your_password_here

# 备份服务器
BACKUP_SERVER_HOST=111.230.36.222
BACKUP_SERVER_USER=backup_user
BACKUP_SERVER_PASSWORD=your_password_here
```

#### 步骤2：验证数据库连接

```bash
# 测试 RDS 连接
mysql -h yinhexingchen.cxhxc.rds.aliyuncs.com \
       -u admin \
       -p \
       -e "SELECT VERSION();"

# 测试备份服务器连接
ssh -p 22 backup_user@111.230.36.222 "ls -lh /backup/yinhexingchen/"
```

#### 步骤3：启动应用

```bash
# 安装依赖
npm install

# 启动应用
node server.js

# 输出应该显示：
# ✅ MySQL数据库已启用，应用与数据库服务器分离
# 服务地址: http://localhost:5098
```

---

## 备份管理

### 手动执行备份

```bash
# 立即执行一次备份
node backup-rds-to-local.js

# 输出示例：
# [2026-04-17T10:30:00.000Z] [INFO] Starting mysqldump...
# [2026-04-17T10:32:00.000Z] [INFO] Compressing backup...
# [2026-04-17T10:33:00.000Z] [INFO] Compression completed
# [2026-04-17T10:34:00.000Z] [INFO] File uploaded to backup server
```

### 启动定时备份

```bash
# 每天凌晨3点自动备份
node backup-rds-to-local.js schedule

# 输出：
# Backup scheduler is running. Press Ctrl+C to stop.
```

**推荐**：使用 systemd 或 PM2 持久化运行

#### 使用 PM2 部署

```bash
# 安装 PM2（全局）
npm install -g pm2

# 启动应用和备份脚本
pm2 start server.js --name "yinhexingchen-app"
pm2 start "node backup-rds-to-local.js schedule" --name "yinhexingchen-backup"

# 开机自启
pm2 startup
pm2 save

# 查看日志
pm2 logs yinhexingchen-backup

# 监控状态
pm2 monit
```

#### 使用 Systemd 部署（Linux）

```bash
# 创建 systemd 服务文件
sudo tee /etc/systemd/system/yinhexingchen-backup.service > /dev/null <<EOF
[Unit]
Description=YinHeXingChen RDS Backup Service
After=network.target

[Service]
Type=simple
User=backup
WorkingDirectory=/home/backup/yinhexingchen
ExecStart=/usr/bin/node /home/backup/yinhexingchen/backup-rds-to-local.js schedule
Restart=on-failure
RestartSec=60

[Install]
WantedBy=multi-user.target
EOF

# 启用服务
sudo systemctl enable yinhexingchen-backup
sudo systemctl start yinhexingchen-backup

# 查看状态
sudo systemctl status yinhexingchen-backup
```

### 查看备份统计

```bash
# 查看本地备份信息
node backup-rds-to-local.js stats

# 输出示例：
# Backup Statistics: {
#   totalBackups: 30,
#   totalSize: '45.67 GB',
#   latestBackup: 'yinhexingchen_prod_2026-04-17T030000.sql.gz',
#   backupDir: '/path/to/db/backups'
# }

# 列出备份文件
ls -lh db/backups/ | tail -20

# 查看备份服务器
ssh backup_user@111.230.36.222 "du -sh /backup/yinhexingchen/*"
```

---

## 数据恢复

### 场景1: 恢复单个账套

```bash
# 1. 查询账套 ID
mysql -h yinhexingchen.cxhxc.rds.aliyuncs.com -u admin -p \
  -e "SELECT id, name FROM accounts WHERE id = 'ACCT_xxx';"

# 2. 删除损坏的 SQLite 文件
rm -f db/account_ACCT_xxx.db

# 3. 重启应用（重新初始化账套数据库）
pm2 restart yinhexingchen-app

# 4. 从备份恢复凭证（如有必要）
# 使用 API 或数据库直接查询和恢复
```

### 场景2: 恢复 RDS 整个数据库

```bash
# 1. 连接到备份服务器
ssh backup_user@111.230.36.222

# 2. 列出可用备份
ls -lh /backup/yinhexingchen/
# 选择需要恢复的备份文件，例如：
# yinhexingchen_prod_2026-04-16T030000.sql.gz

# 3. 下载备份到本地恢复机器
exit
scp backup_user@111.230.36.222:/backup/yinhexingchen/yinhexingchen_prod_2026-04-16T030000.sql.gz ./

# 4. 解压
gunzip yinhexingchen_prod_2026-04-16T030000.sql

# 5. 创建临时数据库
mysql -h yinhexingchen.cxhxc.rds.aliyuncs.com -u admin -p \
  -e "CREATE DATABASE yinhexingchen_recover;"

# 6. 导入备份
mysql -h yinhexingchen.cxhxc.rds.aliyuncs.com -u admin -p \
  yinhexingchen_recover < yinhexingchen_prod_2026-04-16T030000.sql

# 7. 验证数据
mysql -h yinhexingchen.cxhxc.rds.aliyuncs.com -u admin -p \
  -e "SELECT COUNT(*) AS user_count FROM yinhexingchen_recover.users; \
      SELECT COUNT(*) AS account_count FROM yinhexingchen_recover.accounts;"

# 8. 如果验证通过，切换到恢复数据库
# （使用阿里云控制台或 MySQL 命令）

# 9. 删除原数据库和临时数据库
mysql -h yinhexingchen.cxhxc.rds.aliyuncs.com -u admin -p \
  -e "DROP DATABASE yinhexingchen_prod; \
      RENAME TABLE yinhexingchen_recover.* TO yinhexingchen_prod.*;"
```

### 场景3: 时间点恢复 (PITR)

```bash
# 仅适用于阿里云 RDS，在控制台操作
# 1. 登录阿里云 RDS 控制台
# 2. 选择实例 > 数据库恢复
# 3. 选择恢复时间点
# 4. 等待恢复完成（通常 10-30 分钟）
# 5. 选择是否覆盖原数据库
```

---

## 故障排查

### 问题1: RDS 连接超时

**症状**:
```
Error: connect ETIMEDOUT xx.xxx.xxx.xxx:3306
```

**排查步骤**:
```bash
# 1. 检查网络连接
ping yinhexingchen.cxhxc.rds.aliyuncs.com

# 2. 检查 RDS 白名单（阿里云控制台）
# 确保应用服务器 IP 在白名单中

# 3. 检查 RDS 实例状态
# 在阿里云控制台查看 RDS 是否正常运行

# 4. 检查应用网络配置
# 确保有互联网连接和对RDS的访问权限

# 5. 测试 DNS 解析
nslookup yinhexingchen.cxhxc.rds.aliyuncs.com

# 6. 使用 MySQL 客户端测试
mysql -h yinhexingchen.cxhxc.rds.aliyuncs.com \
       -u admin \
       -p \
       -e "SELECT 1;"
```

**解决方案**:
- 将应用服务器 IP 添加到 RDS 安全组
- 或在 RDS 白名单中添加应用服务器 IP

### 问题2: 备份上传失败

**症状**:
```
[ERROR] Connection to backup server failed
[ERROR] Upload failed: No such file or directory
```

**排查步骤**:
```bash
# 1. 测试 SSH 连接
ssh -v -p 22 backup_user@111.230.36.222

# 2. 检查备份目录是否存在
ssh backup_user@111.230.36.222 "ls -lh /backup/yinhexingchen/"

# 3. 检查磁盘空间
ssh backup_user@111.230.36.222 "df -h"

# 4. 检查用户权限
ssh backup_user@111.230.36.222 "touch /backup/yinhexingchen/test.txt"

# 5. 查看应用日志
pm2 logs yinhexingchen-backup | tail -50
```

**解决方案**:
- 验证 SSH 认证信息
- 创建备份目录: `mkdir -p /backup/yinhexingchen/`
- 检查磁盘空间是否充足
- 检查用户权限: `chmod 755 /backup/yinhexingchen/`

### 问题3: 本地账套数据库损坏

**症状**:
```
Error: database disk image is malformed
```

**排查步骤**:
```bash
# 1. 检查 SQLite 完整性
sqlite3 db/account_ACCT_xxx.db "PRAGMA integrity_check;"

# 2. 备份损坏的文件
cp db/account_ACCT_xxx.db db/account_ACCT_xxx.db.corrupted

# 3. 删除文件，重新初始化
rm db/account_ACCT_xxx.db

# 4. 重启应用
pm2 restart yinhexingchen-app

# 5. 应用会自动创建新的空数据库
```

**恢复步骤**:
```bash
# 如果需要恢复之前的凭证数据：
# 1. 从 RDS 查询凭证记录
mysql -h yinhexingchen.cxhxc.rds.aliyuncs.com -u admin -p \
  -e "SELECT * FROM voucher_logs WHERE account_id = 'ACCT_xxx';"

# 2. 使用 API 或脚本重新录入凭证
# 或通过 SQL 直接导入到新的 SQLite 数据库
```

### 问题4: 磁盘空间不足

**症状**:
```
Error: disk I/O error
No space left on device
```

**排查步骤**:
```bash
# 1. 检查磁盘使用情况
df -h
du -sh db/*

# 2. 找出最大的文件
du -sh db/account_*.db | sort -h | tail -10

# 3. 清理备份
rm -f db/backups/*_2026-03-*.sql.gz  # 删除3月的备份

# 4. 清理临时文件
rm -f db/temp_backups/*

# 5. 压缩活跃的账套数据库（不常用）
gzip -9 db/account_ACCT_old.db
```

**预防措施**:
- 定期监控磁盘使用率
- 启用自动清理旧备份的脚本
- 为重要数据配置告警

---

## 性能监控

### 设置监控告警

```bash
# 安装监控工具（可选）
npm install -g nodejs-monitor

# 启用性能监控
ENABLE_METRICS=true node server.js

# 访问监控仪表盘
http://localhost:9090/metrics
```

### 常用监控命令

```bash
# 1. 监控 Node.js 内存占用
node --inspect server.js
# 然后访问 chrome://inspect

# 2. 监控 RDS 连接数
mysql -h yinhexingchen.cxhxc.rds.aliyuncs.com -u admin -p \
  -e "SHOW PROCESSLIST \G" | grep -c "Query"

# 3. 监控应用进程
ps aux | grep node
pm2 monit

# 4. 监控文件系统
watch -n 1 'du -sh db/account_*.db | tail -5'
```

### 设置日志收集

```bash
# 使用 PM2 日志
pm2 logs > /var/log/yinhexingchen.log

# 或使用 logrotate 管理日志
sudo tee /etc/logrotate.d/yinhexingchen > /dev/null <<EOF
/var/log/yinhexingchen.log {
  daily
  missingok
  rotate 30
  compress
  delaycompress
  notifempty
  create 0640 root root
}
EOF
```

---

## 维护计划

### 日常维护（每天）
- ✅ 检查备份是否完成
- ✅ 监控 RDS 连接数
- ✅ 监控磁盘空间

### 每周维护（每周一）
- ✅ 清理过期备份
- ✅ 检查日志大小
- ✅ 验证账套数据库完整性

### 月度维护（月初）
- ✅ 测试数据恢复流程
- ✅ 更新依赖包
- ✅ 审计访问日志
- ✅ 更新监控告警阈值

### 季度维护（每季度）
- ✅ 性能基准测试
- ✅ 容量规划评估
- ✅ 安全审计
- ✅ 灾难恢复演练

---

## 清单和检查表

### 生产环境部署检查表

- [ ] `.env` 文件已配置，敏感信息已加密
- [ ] MySQL/mysqldump 已安装
- [ ] SSH 密钥已配置（如使用密钥认证）
- [ ] 备份目录已创建: `/backup/yinhexingchen/`
- [ ] 定时任务已启动（cron 或 PM2）
- [ ] 监控和告警已配置
- [ ] 日志轮转已设置
- [ ] RDS 白名单已更新
- [ ] 备份恢复流程已测试
- [ ] 文档已更新

### 故障恢复检查表

- [ ] 确认故障原因
- [ ] 通知相关人员
- [ ] 启动备份恢复流程
- [ ] 验证恢复数据的完整性
- [ ] 切换到恢复数据库
- [ ] 测试应用功能
- [ ] 通知用户恢复完成
- [ ] 记录故障日志和处理过程

---

## 常见问题 (FAQ)

**Q: 备份会影响应用性能吗？**

A:
- mysqldump 使用 `--single-transaction` 和 `--quick` 参数，避免锁表
- 压缩和上传在备份脚本中异步进行，不阻塞应用
- 建议在凌晨低峰时段执行备份

**Q: 能否将备份直接上传到阿里云 OSS？**

A:
可以。修改 `backup-rds-to-local.js` 中的上传逻辑，使用阿里云 SDK 上传到 OSS。OSS 存储成本更低。

**Q: 如何处理账套数据库过大？**

A:
1. 定期归档旧凭证（>2年）
2. 删除已审核的凭证的详细信息
3. 分离到新账套数据库
4. 使用数据库分片

**Q: 支持哪些备份策略？**

A:
- 全量备份：每天1次（凌晨3点）
- 增量备份：RDS 自动通过二进制日志支持
- 跨地域备份：可配置 RDS 跨域备份到其他地区

**Q: 备份文件如何加密？**

A:
```bash
# 1. 在备份脚本中添加加密
gpg --encrypt yinhexingchen_prod_*.sql.gz

# 2. 上传加密文件
scp *.sql.gz.gpg backup_user@111.230.36.222:/backup/

# 3. 恢复时解密
gpg --decrypt yinhexingchen_prod_*.sql.gz.gpg | gunzip | mysql
```

---

**版本**: 1.0
**最后更新**: 2026-04-17
**维护者**: DevOps Team
**联系方式**: devops@yinhexingchen.com
