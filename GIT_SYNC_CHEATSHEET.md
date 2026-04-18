# Git 同步快速参考卡片

## 🚀 快速命令

### 启动自动同步
```powershell
# Windows PowerShell
.\start-git-sync.ps1 -Background

# Linux/Mac
./start-git-sync.sh
```

### 停止自动同步
```powershell
# Windows
.\stop-git-sync.ps1

# Linux/Mac
./stop-git-sync.sh
```

### 查看日志
```bash
# 实时查看（Windows & Linux/Mac）
tail -f .git-sync.log

# 查看最后100行
tail -100 .git-sync.log
```

## 📊 Git 基本命令

### 查看状态
```bash
# 查看本地改动
git status

# 查看未推送的提交
git log --oneline origin/master..HEAD

# 查看最近的提交
git log --oneline -10
```

### 手动提交（如果需要）
```bash
# 查看改动
git status

# 添加所有改动
git add -A

# 创建提交
git commit -m "Your message here"

# 推送到GitHub
git push origin master
```

### 查看远程信息
```bash
# 列出远程仓库
git remote -v

# 检查与远程的差异
git fetch origin
git log --oneline master..origin/master
```

## 🔍 常用检查

### 检查守护进程状态
```bash
# 查看 PID 文件（如果存在表示正在运行）
cat .git-sync.pid

# Windows - 查看所有node进程
Get-Process node
```

### 查看最近的提交和推送状态
```bash
# 显示最近5个提交（包括commit hash, message, author）
git log --oneline -5

# 显示本地领先远程多少提交
git log --oneline origin/master..HEAD

# 查看完整的提交信息
git log --oneline --graph --all -10
```

## 🔧 常见任务

### 任务1: 验证自动同步是否工作

1. 修改某个文件（比如在HTML注释中添加一行）
2. 等待5秒钟
3. 执行命令：
```bash
git status
```
4. 应该看到"nothing to commit"或者最近的修改已被提交

### 任务2: 检查是否有未推送的提交

```bash
git log --oneline origin/master..HEAD
```
如果有输出，说明有提交还没推送到GitHub。

### 任务3: 强制推送最新提交

```bash
git push origin master -f  # 谨慎使用！可能覆盖远程
```

### 任务4: 查看GitHub同步进度

```bash
# 1. 检查远程最新提交
git ls-remote origin master

# 2. 比较本地和远程
git fetch origin
git log --oneline -5 origin/master

# 3. 访问GitHub网站检查
# https://github.com/loveyalee/yinhexingchen-finance-browser
```

## ⚠️ 故障排查速查

| 问题 | 命令 | 说明 |
|------|------|------|
| 守护进程没启动 | `node git-sync-daemon.js` | 直接运行查看错误 |
| 没有看到提交 | `git status` | 检查文件是否有改动 |
| 推送失败 | `git push -v origin master` | `-v` 显示详细信息 |
| 多个进程运行 | `Get-Process node` 或 `ps aux \| grep node` | 查看并停止多余进程 |
| 日志为空 | `tail .git-sync.log` | 检查日志是否被创建 |

## 🔐 GitHub认证

### 首次设置

第一次推送时，git可能要求输入GitHub用户名和密码（如果使用HTTPS）。

### 配置凭证缓存（推荐）

缓存15分钟内无需重复输入：
```bash
git config --global credential.helper cache
git config --global credential.helper 'cache --timeout=900'
```

### 使用SSH（更安全）

1. 检查是否有SSH密钥：
```bash
ls ~/.ssh/id_rsa
```

2. 如果没有，生成新密钥：
```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa
```

3. 将公钥（id_rsa.pub）内容复制到 https://github.com/settings/keys

4. 配置git使用SSH：
```bash
git remote set-url origin git@github.com:loveyalee/yinhexingchen-finance-browser.git
```

## 📁 相关文件位置

```
/e/yinhexingchen/
├── git-sync-daemon.js          ← 核心守护进程
├── git-sync.config.json        ← 配置文件
├── start-git-sync.ps1          ← Windows启动
├── stop-git-sync.ps1           ← Windows停止
├── start-git-sync.sh           ← Linux/Mac启动
├── stop-git-sync.sh            ← Linux/Mac停止
├── .git-sync.pid               ← 进程ID（自动生成）
├── .git-sync.log               ← 日志文件（自动生成）
├── GIT_SYNC_SETUP.md           ← 详细指南
├── GITHUB_SYNC_QUICK_START.md  ← 快速开始
├── GITHUB_SETUP_SUMMARY.md     ← 设置总结
└── GIT_SYNC_CHEATSHEET.md      ← 本文件
```

## 💡 实用技巧

### 1. 追踪单个文件的变更
```bash
git log --oneline -- filename.html
```

### 2. 查看特定提交的修改
```bash
git show <commit-hash>
```

### 3. 查看文件在某个时间点的内容
```bash
git show <commit-hash>:path/to/file
```

### 4. 恢复误删的文件
```bash
git restore <filename>
```

### 5. 查看提交之间的差异
```bash
git diff <commit1> <commit2>
```

## 🎯 工作流快速指南

```
┌─ 打开编辑器
│  └─ 编辑文件
│     └─ 保存文件
│
└─ 5秒后
   └─ 守护进程自动检测改动
      └─ git add -A
         └─ git commit
            └─ 标记为待推送
               │
               └─ 30秒后
                  └─ git push origin master
                     ├─ 成功 ✅
                     └─ 失败 🔄 自动重试
```

## 📞 获取帮助

- **详细指南**: `GIT_SYNC_SETUP.md`
- **快速开始**: `GITHUB_SYNC_QUICK_START.md`
- **完整总结**: `GITHUB_SETUP_SUMMARY.md`
- **Git官方**: `git help <command>`

---

**保存这个文件以便快速查阅！**

最后更新: 2026-04-18
