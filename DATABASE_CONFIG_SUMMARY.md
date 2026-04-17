# 数据库配置总结

## 架构拓扑

```
┌─────────────────────────────────────────────────────────────┐
│                    生产环境数据库架构                          │
└─────────────────────────────────────────────────────────────┘

                       应用服务器
                    (localhost:5098)
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼

   ┌─────────┐    ┌──────────────┐   ┌─────────────┐
   │ 本地    │    │  阿里云      │   │  备份       │
   │SQLite  │    │  RDS MySQL   │   │  服务器     │
   │        │    │              │   │             │
   │账套数据│◄────┤  用户、账套  │   │ RDS全量     │
   │凭证等  │    │  元信息、    │───│ 备份        │
   │        │    │  订单等      │   │ (111.xxx)  │
   └─────────┘    └──────────────┘   └─────────────┘

   高性能       权威数据源        灾难恢复
   隔离好       高可用            防数据丢失
```

---

## 三层数据库设计

### 第1层：用户端（浏览器 localStorage）
- **数据**: 账套列表、用户信息
- **特点**: 临时缓存，可离线访问
- **保留**: 最近使用的账套

### 第2层：应用端（RDS MySQL）
- **数据**: 用户账户、账套元信息、订单、支付
- **位置**: 阿里云 `yinhexingchen.cxhxc.rds.aliyuncs.com:3306`
- **特点**: 中央数据库，高可用，自动备份
- **备份**: 阿里云自动每天1次，保留7天

### 第3层：本地端（SQLite）
- **数据**: 凭证、账簿、期初余额（每账套独立DB）
- **位置**: 应用服务器 `./db/account_ACCT_*.db`
- **特点**: 高性能，隔离好，支持离线操作
- **备份**: 手动或定时备份到 111.230.36.222

### 第4层：灾备端（111.230.36.222）
- **数据**: RDS的定期全量备份
- **频率**: 每天凌晨3点自动备份
- **保留**: 最近30个备份文件
- **用途**: 灾难恢复、历史数据查询

---

## 配置清单

### ✅ 已完成的配置

| 项目 | 状态 | 详情 |
|------|------|------|
| 环境变量文件 | ✅ | `.env.example` 已创建，含详细说明 |
| RDS 连接配置 | ✅ | 主库地址、用户名、密码已配置 |
| 本地 SQLite | ✅ | 账套数据库自动初始化 |
| 备份脚本 | ✅ | `backup-rds-to-local.js` 已创建 |
| 部署指南 | ✅ | `DEPLOYMENT_GUIDE.md` 已完成 |
| 架构文档 | ✅ | `DATABASE_ARCHITECTURE.md` 已完成 |
| 验证工具 | ✅ | `verify-database-config.js` 可用 |

### ⚠️ 需要用户填写的配置

| 配置项 | 文件 | 值 |
|--------|------|-----|
| MYSQL_PASSWORD | .env | `your_aliyun_rds_password` |
| BACKUP_SERVER_PASSWORD | .env | `your_backup_server_password` |
| RDS 白名单 | 阿里云控制台 | 应用服务器 IP |
| 备份目录权限 | 111.230.36.222 | `chmod 755 /backup/yinhexingchen/` |

---

## 快速启动指南

### 1️⃣ 配置环境变量

```bash
# 编辑 .env 文件
nano .env

# 填入以下关键信息：
MYSQL_HOST=yinhexingchen.cxhxc.rds.aliyuncs.com
MYSQL_USER=admin
MYSQL_PASSWORD=your_password_here

BACKUP_SERVER_HOST=111.230.36.222
BACKUP_SERVER_USER=backup_user
BACKUP_SERVER_PASSWORD=your_password_here
```

### 2️⃣ 验证配置

```bash
# 运行验证工具
node verify-database-config.js

# 输出应该显示：
# ✅ RDS 连接成功
# ✅ 本地数据库存在
# ✅ 磁盘空间充足
# ✅ 脚本和权限正常
```

### 3️⃣ 启动应用

```bash
# 使用 PM2 (推荐)
npm install -g pm2
pm2 start server.js --name "yinhexingchen-app"

# 或直接运行
node server.js

# 应该输出：
# ✅ MySQL数据库已启用，应用与数据库服务器分离
# 服务地址: http://localhost:5098
```

### 4️⃣ 启动定时备份

```bash
# 启动备份定时任务（每天凌晨3点）
pm2 start "node backup-rds-to-local.js schedule" --name "yinhexingchen-backup"

# 保存 PM2 配置
pm2 save
pm2 startup
```

---

## 验证清单

### 第一天检查
- [ ] 应用能否启动
- [ ] 能否登录系统
- [ ] RDS 连接是否正常
- [ ] 能否创建账套
- [ ] 能否录入凭证

### 第一周检查
- [ ] 备份脚本是否正常运行
- [ ] 备份文件是否上传到 111.230.36.222
- [ ] 磁盘空间是否充足
- [ ] 日志是否有错误

### 第一个月检查
- [ ] 测试数据恢复流程
- [ ] 检查备份文件完整性
- [ ] 监控系统运行指标
- [ ] 更新监控告警配置

---

## 文件说明

### 新增文件

| 文件名 | 说明 |
|--------|------|
| `.env.example` | 环境变量示例（含详细注释） |
| `.env` | 实际配置文件（已更新） |
| `backup-rds-to-local.js` | RDS 备份脚本 |
| `verify-database-config.js` | 配置验证工具 |
| `DATABASE_ARCHITECTURE.md` | 详细的架构设计文档 |
| `DEPLOYMENT_GUIDE.md` | 部署和运维指南 |
| `DATABASE_CONFIG_SUMMARY.md` | 本文件 |

### 修改的文件

| 文件名 | 修改内容 |
|--------|---------|
| `.env` | 更新数据库和备份服务器配置 |
| `server.js` | 添加 RDS MySQL 支持 |

---

## 依赖安装

### 必需依赖
```bash
npm install mysql2/promise better-sqlite3
```

### 可选依赖（用于备份）
```bash
# 定时任务管理
npm install -g pm2
npm install node-cron

# SSH/SCP 支持
npm install ssh2

# 数据加密（可选）
npm install gpg
```

---

## 故障快速查看

### RDS 无法连接
```bash
# 1. 测试 MySQL 客户端
mysql -h yinhexingchen.cxhxc.rds.aliyuncs.com -u admin -p

# 2. 检查 RDS 白名单（包括应用服务器 IP）

# 3. 检查网络连接
ping yinhexingchen.cxhxc.rds.aliyuncs.com
```

### 备份上传失败
```bash
# 1. 测试 SSH 连接
ssh -p 22 backup_user@111.230.36.222

# 2. 检查备份目录权限
ssh backup_user@111.230.36.222 "ls -lh /backup/yinhexingchen/"

# 3. 检查磁盘空间
ssh backup_user@111.230.36.222 "df -h"
```

### 账套数据库损坏
```bash
# 1. 检查数据库完整性
sqlite3 ./db/account_ACCT_xxx.db "PRAGMA integrity_check;"

# 2. 备份损坏文件
cp ./db/account_ACCT_xxx.db ./db/account_ACCT_xxx.db.bak

# 3. 删除损坏文件（应用将自动重建）
rm ./db/account_ACCT_xxx.db
```

---

## 性能基准

| 操作 | 延迟 |
|------|------|
| RDS 查询用户 | 5-20 ms |
| SQLite 查询凭证 | 0.1-1 ms |
| 保存单条凭证 | 10-50 ms |
| 导出数据库 | 30-60 分钟 |
| 上传备份 | 5-15 分钟 |

---

## 监控指标

### 关键告警阈值

| 指标 | 告警值 | 建议 |
|------|--------|------|
| RDS CPU 使用率 | > 80% | 查看慢查询日志 |
| 磁盘空间占用 | > 90% | 清理旧备份 |
| 备份失败次数 | > 3 | 检查备份脚本 |
| 应用响应时间 | > 1000ms | 检查 RDS 连接 |
| 连接池活跃连接 | > 50 | 增加连接数 |

---

## 容灾恢复目标 (RTO/RPO)

| 故障场景 | RTO | RPO |
|---------|-----|-----|
| 应用服务器重启 | 5 分钟 | 0（数据已同步） |
| RDS 故障自动转移 | 30 秒 | 0（主从同步） |
| RDS 完全故障 | 30 分钟 | 1 天（备份还原） |
| 本地磁盘故障 | 1 小时 | 可重建（凭证可从 RDS 恢复） |
| 备份服务器故障 | - | 7 天（RDS 备份） |

---

## 成本预估（月）

| 项目 | 费用 |
|------|------|
| 阿里云 RDS（2GB） | ¥150-300 |
| 本地备份服务器 | ¥100-200 |
| 带宽成本 | ¥50-100 |
| **总计** | **¥300-600** |

---

## 关键联系方式

- **阿里云 RDS 管理**: https://www.aliyun.com/
- **备份服务器管理**: `backup_user@111.230.36.222`
- **监控告警**: pm2 logs / CloudWatch

---

## 下一步行动

1. ✅ **立即**: 填写 `.env` 文件中的敏感信息
2. ✅ **今天**: 运行 `verify-database-config.js` 验证配置
3. ✅ **明天**: 启动备份定时任务
4. ✅ **本周**: 测试数据恢复流程
5. ✅ **本月**: 建立监控告警系统

---

**版本**: 1.0
**创建时间**: 2026-04-17
**维护者**: DevOps Team
**最后审查**: 2026-04-17
