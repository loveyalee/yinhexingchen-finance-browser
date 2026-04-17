# 数据库架构设计文档

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        用户浏览器客户端                          │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/HTTPS
┌────────────────────────▼────────────────────────────────────┐
│                   应用服务器 (localhost:5098)                  │
│                  Node.js + Express                           │
└────────┬───────────────┬──────────────┬─────────────────────┘
         │               │              │
    ┌────▼────┐     ┌────▼────┐   ┌────▼────┐
    │ 本地     │     │ 阿里云   │   │ 备份    │
    │SQLite   │     │RDS MySQL│   │服务器   │
    │(账套)    │     │(主库)    │   │(备份)   │
    └─────────┘     └─────────┘   └────────┘
       本地磁盘   高可用主库      异地灾备
```

---

## 核心数据库设计

### 1️⃣ 阿里云 RDS MySQL（主数据库）

#### 部署信息
- **服务器**: `yinhexingchen.cxhxc.rds.aliyuncs.com:3306`
- **数据库**: `yinhexingchen_prod`
- **用户**: `admin`
- **特性**: 高可用、自动备份、自动故障转移

#### 存储内容

```sql
-- 用户表
CREATE TABLE users (
  id VARCHAR(64) PRIMARY KEY,
  phone VARCHAR(20) NOT NULL UNIQUE,
  username VARCHAR(100),
  password VARCHAR(255),
  user_type ENUM('personal', 'enterprise', 'institution'),
  create_time DATETIME,
  ...
);

-- 账套元信息
CREATE TABLE accounts (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64),
  name VARCHAR(100),
  industry VARCHAR(50),
  start_date DATE,
  accounting_system VARCHAR(50),
  db_file VARCHAR(255),        -- 本地SQLite路径
  last_backup_time DATETIME,
  ...
);

-- 订单和支付记录
CREATE TABLE orders (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64),
  amount DECIMAL(10,2),
  status VARCHAR(20),
  create_time DATETIME,
  ...
);

-- 其他业务表
-- products, invoices, payments, etc.
```

#### 访问方式
```javascript
// Node.js 连接示例
const mysql = require('mysql2/promise');
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT,
  database: process.env.MYSQL_DATABASE,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 使用连接池
const conn = await pool.getConnection();
const [rows] = await conn.execute('SELECT * FROM users WHERE id = ?', [userId]);
conn.release();
```

#### 阿里云RDS配置（控制台）
1. **自动备份**
   - 备份周期: 每天1次
   - 保留天数: 7天
   - 备份时间: 02:00-03:00 UTC+8

2. **高可用架构**
   - 主-从结构（同可用区）
   - 故障自动转移（秒级）
   - 实时二进制日志同步

3. **性能优化**
   - 连接数限制: 最多支持600个
   - 存储空间: 按需付费，无上限
   - 网络: 阿里云内网，无额外延迟

---

### 2️⃣ 本地 SQLite（账套数据库）

#### 部署信息
- **位置**: 应用服务器本地磁盘 `./db/account_ACCT_*.db`
- **特性**: 高性能、隔离度好、支持离线操作

#### 存储内容
每个账套拥有独立的SQLite数据库文件：

```sql
-- 凭证表
CREATE TABLE vouchers (
  id INTEGER PRIMARY KEY,
  voucher_no TEXT,
  date TEXT,
  summary TEXT,
  debit_account TEXT,
  credit_account TEXT,
  amount REAL,
  status TEXT,
  create_time TEXT,
  ...
);

-- 期初余额表
CREATE TABLE opening_balances (
  id INTEGER PRIMARY KEY,
  account_code TEXT,
  account_name TEXT,
  direction TEXT,
  amount REAL,
  create_time TEXT,
  ...
);

-- 账簿表
CREATE TABLE ledger (
  id INTEGER PRIMARY KEY,
  account_code TEXT,
  date TEXT,
  summary TEXT,
  debit REAL,
  credit REAL,
  balance REAL,
  ...
);
```

#### 访问方式
```javascript
// Node.js 连接示例
const Database = require('better-sqlite3');
const db = new Database('./db/account_ACCT_123456.db');

// 同步操作，高性能
const stmt = db.prepare('SELECT * FROM vouchers WHERE date = ?');
const vouchers = stmt.all('2026-04-17');

db.close();
```

#### 性能特性
- **查询速度**: 毫秒级
- **写入吞吐**: 单线程 10000+ ops/sec
- **文件大小**: 通常 1-100 MB per account
- **故障恢复**: 支持WAL模式（Write-Ahead Logging）

---

### 3️⃣ 备份服务器（灾难恢复）

#### 部署信息
- **服务器**: `111.230.36.222`
- **认证**: SSH (port 22)
- **用户**: `backup_user`
- **备份路径**: `/backup/yinhexingchen/`

#### 备份内容

```
/backup/yinhexingchen/
├── 2026-04-17_030000/
│   └── yinhexingchen_prod_2026-04-17T030000.sql.gz  (主库备份)
├── 2026-04-16_030000/
│   └── yinhexingchen_prod_2026-04-16T030000.sql.gz
├── 2026-04-15_030000/
│   └── yinhexingchen_prod_2026-04-15T030000.sql.gz
└── ... (保留最近30个备份)
```

#### 备份流程
```
每天凌晨3点
    ↓
应用服务器执行 mysqldump
    ↓
导出SQL文件 (通常 50-200 MB)
    ↓
gzip压缩 (压缩率 80-90%)
    ↓
通过 SFTP 上传到 111.230.36.222
    ↓
保存到 /backup/yinhexingchen/
    ↓
定期清理（保留30天）
```

#### 恢复步骤
```bash
# 1. 连接到备份服务器
ssh backup_user@111.230.36.222

# 2. 查看可用备份
ls -lh /backup/yinhexingchen/

# 3. 下载备份到恢复机器
scp backup_user@111.230.36.222:/backup/yinhexingchen/yinhexingchen_prod_*.sql.gz ./

# 4. 解压备份
gunzip yinhexingchen_prod_*.sql.gz

# 5. 导入到临时数据库
mysql -h yinhexingchen.cxhxc.rds.aliyuncs.com -u admin -p < yinhexingchen_prod_*.sql

# 6. 验证数据
mysql -h yinhexingchen.cxhxc.rds.aliyuncs.com -u admin -p -e "SELECT COUNT(*) FROM users;"
```

---

## 数据流和一致性

### 用户登录流程
```
1. 用户输入账号密码
   ↓
2. 应用向 RDS MySQL 查询用户记录
   ↓
3. 密码校验通过，返回 userInfo
   ↓
4. 应用将 userInfo 存储到浏览器 localStorage
   ↓
5. 用户选择账套，跳转到 accounting_v2.html?accountId=ACCT_xxx
   ↓
6. 应用从 localStorage 读取并校验 accountId
   ↓
7. 加载 ./db/account_ACCT_xxx.db
```

### 凭证录入和保存流程
```
1. 用户在 accounting_v2.html 录入凭证
   ↓
2. 点击"保存凭证"
   ↓
3. 前端校验借贷平衡
   ↓
4. POST /api/accounts/ACCT_xxx/vouchers (发送凭证数据)
   ↓
5. 后端向本地 SQLite 写入凭证 (同步操作，毫秒级)
   ↓
6. 后端返回成功响应
   ↓
7. 凭证立即显示在界面
   ↓
8. 每日凌晨3点，自动备份 RDS（包含凭证同步日志）
```

### 数据一致性保证
```
RDS 主库（权威数据源）
    ↓
    └─→ 凭证关键字段（审核状态、删除标记等）
    └─→ 用户账套关联
    └─→ 订单和支付记录

SQLite 本地库（衍生数据）
    ↓
    └─→ 凭证明细（可重新计算）
    └─→ 账簿（可重新生成）
    └─→ 报表数据（可重新汇总）

备份库（恢复数据源）
    ↓
    └─→ RDS 的完整镜像
    └─→ 用于灾难恢复
    └─→ 用于历史数据查询
```

---

## 故障场景和恢复方案

### 场景1️⃣: 应用服务器崩溃
**症状**: 网站无法访问
**恢复**:
1. 启动备用应用服务器
2. 从备份恢复本地账套数据库
3. RDS 数据自动保持一致
4. 用户数据无损失

### 场景2️⃣: RDS 故障
**症状**: 用户无法登录、账套无法创建
**恢复**:
1. 阿里云自动故障转移（主-从切换，秒级）
2. 如果无法自动恢复，从备份服务器导入备份
3. 最多丢失1天的数据（每天备份1次）

### 场景3️⃣: 本地账套数据库损坏
**症状**: 进入账套后出错
**恢复**:
1. 查询 RDS 中账套的数据库路径
2. 删除损坏的 `.db` 文件
3. 重新初始化空数据库
4. 从凭证历史日志恢复凭证记录
5. 用户可继续使用

### 场景4️⃣: 备份服务器不可达
**症状**: 每日定时备份失败
**恢复**:
1. 检查网络连接
2. 验证 SSH 认证
3. RDS 本身仍有备份（最近7天）
4. 手动上传备份（使用 scp）

---

## 容量规划

### 存储需求预估

| 组件 | 单位 | 数量 | 大小 |
|------|------|------|------|
| RDS 主库 | 用户 | 10,000 | 50 MB |
| RDS 主库 | 账套 | 50,000 | 500 MB |
| RDS 主库 | 凭证 | 5,000,000 | 2 GB |
| **RDS 总计** | - | - | **2.5 GB** |
| - | - | - | - |
| SQLite 账套数据库 | 个 | 50,000 | 50-100 MB each |
| **本地存储** | - | - | **2.5-5 TB** |
| - | | - | - |
| 每日备份 | 次 | 1 | 200-500 MB |
| **备份存储（30天）** | - | - | **6-15 GB** |

### 性能指标

| 指标 | 值 |
|------|-----|
| RDS 查询延迟 | 5-20 ms |
| SQLite 查询延迟 | 0.1-1 ms |
| 凭证保存吞吐 | 100+ ops/sec |
| 日均备份时间 | 30-60 分钟 |
| RDS 恢复时间 | < 5 分钟 |

---

## 监控和告警

### 关键指标
```
1. RDS 连接数
   - 告警阈值：> 100
   - 检查频率：每分钟

2. RDS CPU 使用率
   - 告警阈值：> 80%
   - 检查频率：每分钟

3. 备份上传成功率
   - 告警阈值：< 95%
   - 检查频率：每天

4. 账套数据库大小
   - 告警阈值：> 500 MB
   - 检查频率：每周

5. 磁盘空闲空间
   - 告警阈值：< 10 GB
   - 检查频率：每小时
```

### 监控脚本
```bash
# 检查 RDS 连接状态
mysql -h yinhexingchen.cxhxc.rds.aliyuncs.com -u admin -p -e "SHOW PROCESSLIST;"

# 检查备份文件
ls -lh /backup/yinhexingchen/ | head -10

# 检查本地账套数据库大小
du -sh ./db/account_*.db | sort -h

# 查看最新备份时间
stat /backup/yinhexingchen/$(ls -t /backup/yinhexingchen/ | head -1)
```

---

## 最佳实践

### 1. 定期测试恢复
```bash
# 每月执行一次恢复测试
1. 从备份下载导出文件
2. 导入到临时数据库
3. 运行数据完整性检查
4. 删除临时数据库
```

### 2. 监控备份大小趋势
```bash
# 定期检查备份增长速率
du -sh /backup/yinhexingchen/* | tail -10
```

### 3. 定期清理本地旧数据
```bash
# 定期归档旧账套数据库
find ./db -name "account_*.db" -mtime +90 -delete
```

### 4. 使用读写分离
```javascript
// 读操作可以从备库读（降低主库压力）
const readPool = mysql.createPool({ host: 'read-replica.rds...' });
const writePool = mysql.createPool({ host: 'yinhexingchen.cxhxc.rds...' });
```

---

## 成本优化

### 阿里云 RDS
- **按量付费**: 比预留容量便宜
- **备份存储**: 与实例容量同步，无单独费用
- **跨域备份**: 跨地域备份需额外费用

### 本地备份服务器
- **带宽成本**: SSH/SCP 上传的网络带宽
- **存储成本**: /backup 目录占用的磁盘空间

### 优化建议
1. 使用阿里云 OSS 存储长期备份（成本更低）
2. 启用 RDS 压缩二进制日志
3. 定期清理过期备份

---

## 迁移和升级

### 从本地 SQLite 迁移到 RDS

```bash
# 1. 导出本地 SQLite
sqlite3 ./db/accounts.db ".dump" > accounts.sql

# 2. 转换为 MySQL 语法
# （手动调整数据类型、索引等）

# 3. 导入到 RDS
mysql -h yinhexingchen.cxhxc.rds.aliyuncs.com -u admin -p < accounts.sql

# 4. 验证数据一致性
SELECT COUNT(*) FROM accounts; -- 应该与本地记录匹配
```

### RDS 版本升级
1. 在阿里云控制台选择升级版本
2. 选择合适的维护窗口（凌晨2-3点）
3. 系统自动执行升级
4. 无需应用层修改

---

**最后更新**: 2026-04-17
**维护人员**: DevOps Team
**下次审查**: 2026-07-17
