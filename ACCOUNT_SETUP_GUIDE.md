# 账套创建流程诊断与修复指南

## 当前状态

### ✅ 已正常工作的部分
1. **本地SQLite数据库** - 账套创建时自动生成独立DB文件
   - 路径: `db/account_ACCT_*.db`
   - 包含: 凭证、期初余额、财务数据

2. **账套元信息存储** - 保存在主数据库
   - 路径: `db/accounts.db`
   - 记录: 账套ID、名称、行业、启用期间等

3. **localStorage持久化** - 浏览器端缓存
   - 存储: 最近使用账套列表
   - 作用: 离线可用, 快速切换

### ⚠️ 需要完善的部分

1. **云备份流程**
   - 当前: 本地文件备份到 `db/cloud_backup/`
   - 需要: 上传到阿里云OSS或RDS

2. **后端服务器配置**
   - 需要: 配置环境变量 (.env 文件)
   - 内容: 阿里云 Access Key, RDS 连接信息

## 修复步骤

### Step 1: 验证前端逻辑 ✅（已完成）

**修改内容:**
- `finance_software.html`: 改进 `enterAccount` 函数，确保账套ID正确传递
- `accounting_v2.js`: 添加异步加载，等待DOM准备完毕再初始化

**验证方法:**
```javascript
// 在浏览器控制台运行
console.log(localStorage.getItem('currentAccountId'));
console.log(localStorage.getItem('currentAccount'));
// 应该能看到已选中的账套信息
```

### Step 2: 本地数据库初始化 ✅（已完成）

**自动完成的步骤:**
1. 创建账套时触发 `initAccountDb(accountId)`
2. 创建SQLite数据库文件 `account_ACCT_*.db`
3. 初始化表结构: 凭证表、期初余额表、账簿表等

**验证方法:**
```bash
# Windows PowerShell
ls .\db\account_*.db

# MacOS/Linux
ls ./db/account_*.db
```

### Step 3: 配置阿里云备份（可选）

**需要的环境变量 (.env):**
```
# 阿里云 OSS 配置
ALIYUN_OSS_REGION=oss-cn-hangzhou
ALIYUN_OSS_ACCESS_KEY_ID=your_access_key
ALIYUN_OSS_ACCESS_KEY_SECRET=your_secret
ALIYUN_OSS_BUCKET=yinhexingchen-backups

# 或阿里云 RDS 配置
MYSQL_HOST=rm-*.aliyuncs.com
MYSQL_PORT=3306
MYSQL_DATABASE=yinhexingchen_prod
MYSQL_USER=admin
MYSQL_PASSWORD=your_password
```

**备份脚本示例:**
```javascript
// 手动触发备份
POST /api/accounts/:accountId/backup
```

### Step 4: 配置本地服务器备份（111.230.36.222）

**需要的信息:**
- 服务器SSH认证信息
- 备份存储路径
- 定时任务（cron）

**推荐备份策略:**
```bash
# 每天午夜备份一次
0 0 * * * /path/to/backup-script.sh

# 备份脚本内容示例
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
SOURCE="/data/yinhexingchen/db/"
DEST="/backup/yinhexingchen/$DATE/"
rsync -avz $SOURCE user@111.230.36.222:$DEST
```

## 测试账套创建流程

### 1. 在前端创建新账套

**UI操作:**
```
进入 finance_software.html
→ 点击 "新建账套"
→ 填写信息（名称、行业、日期等）
→ 点击 "创建并进入"
```

**预期结果:**
- 提示 "账套创建成功，正在初始化数据库..."
- 跳转到 `opening_balance_prompt.html?accountId=ACCT_xxx`
- 本地生成 `db/account_ACCT_xxx.db` 文件
- localStorage 保存账套信息

### 2. 验证数据库创建

**检查本地数据库:**
```bash
# 列出所有账套数据库
ls -lh db/account_*.db

# 检查主数据库中的账套记录
sqlite3 db/accounts.db "SELECT id, name, industry, create_time FROM accounts;"
```

**预期输出:**
```
id            | name              | industry            | create_time
ACCT_xxx      | 我的公司          | recycling_resource  | 2026-04-17...
```

### 3. 验证备份文件

**检查备份文件:**
```bash
ls -lh db/cloud_backup/

# 查看最新备份内容
cat db/cloud_backup/ACCT_xxx_*.json
```

### 4. 进入账套工作

**UI操作:**
```
finance_software.html
→ 点击 "进入账套"
→ 应该正常跳转到 accounting_v2.html?accountId=ACCT_xxx
```

**浏览器控制台检查:**
```javascript
// 应该看到这条日志
console.log('App initialized successfully', { accountId: '...' })

// 检查accountId参数
new URLSearchParams(location.search).get('accountId')
```

## 常见问题排查

### Q1: 点"进入账套"没反应

**可能原因:**
1. ❌ 还没有选择账套
   - **解决**: 先点"选择账套"或"新建账套"

2. ❌ localStorage 被清空
   - **解决**: 重新登录并选择账套

3. ❌ 浏览器 console 有报错
   - **解决**: 按 F12 打开控制台，检查报错信息

**调试步骤:**
```javascript
// 在 finance_software.html 的控制台运行
console.log('picked:', picked);
console.log('localStorage accounts:', localStorage.getItem('accountingAccounts'));
console.log('currentAccountId:', localStorage.getItem('currentAccountId'));
```

### Q2: 创建后数据库文件不存在

**可能原因:**
1. ❌ 后端服务未启动
   - **解决**: `node server.js`

2. ❌ db 目录权限不足
   - **解决**: `chmod 755 db/`

3. ❌ better-sqlite3 未安装
   - **解决**: `npm install better-sqlite3`

### Q3: 进入账套后页面白屏

**可能原因:**
1. ❌ accounting_v2.html 的 JS 加载失败
   - **解决**: 检查浏览器 Network 标签

2. ❌ accountId 参数丢失
   - **解决**: 检查 URL 是否包含 `?accountId=ACCT_xxx`

3. ❌ 账套数据库损坏
   - **解决**: 删除 `db/account_ACCT_xxx.db` 并重建

**调试步骤:**
```javascript
// 在 accounting_v2.html 的控制台运行
console.log('accountId:', new URLSearchParams(location.search).get('accountId'));
console.log('localStorage:', localStorage.getItem('currentAccount'));
```

## 数据流图

```
前端 (finance_software.html)
    ↓ 填写账套信息
    ↓ POST /api/accounts
    ↓
后端 (server.js)
    ├→ 1. initAccountDb() → db/account_ACCT_xxx.db ✅
    ├→ 2. mainDb.insert() → db/accounts.db ✅
    ├→ 3. cloudBackupAccount() → db/cloud_backup/ACCT_xxx_*.json ✅
    └→ 返回 { id, name, ... }
    ↓
前端 (finance_software.html)
    ├→ localStorage.setItem('currentAccountId', id)
    ├→ localStorage.setItem('currentAccount', {...})
    └→ window.location.href = 'opening_balance_prompt.html?accountId=' + id
    ↓
前端 (accounting_v2.html)
    ├→ 读取 URL 参数 ?accountId=ACCT_xxx
    ├→ 从 localStorage 恢复账套信息
    ├→ 初始化UI和数据表格
    └→ 页面就绪，用户可开始记账
```

## 启用邮件/钉钉通知（可选）

当账套创建时自动通知管理员：

```javascript
// 在 server.js 创建账套成功后添加

notifyAdminNewAccount({
  accountId: accountId,
  name: a.name,
  industry: a.industry,
  userId: data.userId,
  timestamp: now
});
```

---

**最后修改**: 2026-04-17
**状态**: 本地数据库 ✅ | 云备份 ⚠️ | 前端流程 ✅
