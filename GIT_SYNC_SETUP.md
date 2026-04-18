# Git 实时同步设置指南

## 📋 概述

本项目已配置实时同步功能，可以自动监视本地文件变更，并自动提交和推送到GitHub。这样您不需要手动执行 `git add`、`git commit` 和 `git push` 命令。

## 🔗 GitHub仓库

- **仓库地址**: https://github.com/loveyalee/yinhexingchen-finance-browser.git
- **分支**: master
- **远程名称**: origin

## 🚀 快速开始

### 在 Windows 上启动（使用 PowerShell）

```powershell
# 1. 打开PowerShell（以管理员身份）

# 2. 导航到项目目录
cd /e/yinhexingchen

# 3. 启动守护进程（后台运行）
.\start-git-sync.ps1 -Background

# 或者前台运行（便于调试）
.\start-git-sync.ps1
```

### 在 Linux/Mac 上启动

```bash
# 1. 导航到项目目录
cd /e/yinhexingchen

# 2. 赋予执行权限
chmod +x start-git-sync.sh stop-git-sync.sh

# 3. 启动守护进程
./start-git-sync.sh
```

## 🛑 停止守护进程

### Windows
```powershell
.\stop-git-sync.ps1
```

### Linux/Mac
```bash
./stop-git-sync.sh
```

## 📁 相关文件

| 文件名 | 说明 |
|--------|------|
| `git-sync-daemon.js` | 核心守护进程脚本 |
| `git-sync.config.json` | 配置文件 |
| `start-git-sync.ps1` | Windows启动脚本 |
| `stop-git-sync.ps1` | Windows停止脚本 |
| `start-git-sync.sh` | Linux/Mac启动脚本 |
| `stop-git-sync.sh` | Linux/Mac停止脚本 |
| `.git-sync.pid` | 进程ID文件（自动生成） |
| `.git-sync.log` | 日志文件（自动生成） |

## ⚙️ 工作原理

### 监视循环 (每 5 秒)
```
检查本地文件变更
  ↓
发现改动 → 自动执行 git add -A
  ↓
生成提交信息 → 自动执行 git commit
  ↓
标记为待推送
```

### 推送循环 (每 30 秒)
```
检查是否有待推送的改动
  ↓
执行 git push origin master
  ↓
成功 → 清除待推送标记
失败 → 重试 (最多 3 次)
```

### 远程更新拉取 (每 10 分钟)
```
执行 git pull origin master --no-edit
获取远程的最新更新
合并到本地分支
```

## 📊 监视的文件类型

根据 `git-sync.config.json` 配置，以下文件将被监视：

- `**/*.html` - HTML文件
- `**/*.js` - JavaScript文件
- `**/*.json` - JSON文件
- `**/*.md` - Markdown文件
- `**/*.css` - CSS文件

## 🚫 忽略的文件/目录

以下文件/目录的变更不会被提交：

```
node_modules/**
.git/**
.vscode/**
.idea/**
build/**
dist/**
*.log
.env
.sync-watch.pid
```

## 📝 提交信息格式

自动生成的提交信息格式为：

```
[Auto-Sync] 2026-04-18 15:30:45
```

格式: `[Auto-Sync] YYYY-MM-DD HH:MM:SS`

## 📈 查看日志

### Windows
```powershell
# 查看实时日志
Get-Content -Path ".git-sync.log" -Wait

# 或者使用tail命令（如果已安装）
tail -f .git-sync.log
```

### Linux/Mac
```bash
# 查看实时日志
tail -f .git-sync.log

# 或者查看最后100行
tail -100 .git-sync.log

# 查看整个日志
cat .git-sync.log
```

## 🔍 故障排查

### 问题 1: 守护进程无法启动

**症状**: PowerShell/终端输出 "进程启动失败"

**解决方案**:
1. 检查 Node.js 是否正确安装: `node --version`
2. 检查当前目录是否是 Git 仓库: `git rev-parse --git-dir`
3. 查看详细错误信息: 运行 `.\start-git-sync.ps1` 而不加 `-Background`

### 问题 2: 文件没有被提交

**症状**: 修改了文件但没有看到git提交

**解决方案**:
1. 检查文件是否在 `.gitignore` 中
2. 检查文件是否在监视列表中（见上面的监视文件类型）
3. 查看日志文件确认守护进程是否在运行
4. 手动检查git状态: `git status`

### 问题 3: 推送失败

**症状**: 看到"推送失败"的日志

**解决方案**:
1. 检查网络连接: `ping github.com`
2. 检查GitHub认证: `git ls-remote origin master`
3. 检查本地分支是否与远程同步: `git log --oneline -5 origin/master..HEAD`
4. 手动推送测试: `git push origin master`

### 问题 4: 多个守护进程在运行

**症状**: 同时启动了多个守护进程

**解决方案**:
```powershell
# Windows - 查看所有node进程
Get-Process node

# 查看特定PID的进程
Get-Process -Id <PID>

# 停止进程
Stop-Process -Id <PID> -Force

# Linux/Mac
ps aux | grep git-sync-daemon
kill -9 <PID>
```

## 🔐 GitHub认证

### 使用 HTTPS（推荐）

如果多次提示输入密码，可以配置git凭证缓存：

```bash
# 缓存凭证15分钟
git config --global credential.helper cache
git config --global credential.helper 'cache --timeout=900'

# 或者永久保存（需要谨慎）
git config --global credential.helper store
```

### 使用 SSH（更安全）

1. 生成SSH密钥（如果没有）:
```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa
```

2. 将公钥添加到GitHub: https://github.com/settings/keys

3. 配置git使用SSH:
```bash
git remote set-url origin git@github.com:loveyalee/yinhexingchen-finance-browser.git
```

## 📊 监控状态

守护进程每 2 分钟会输出当前状态：

```
📊 当前状态:
  本地改动: 有
  等待推送: 是
  推送中: 否
  待推送的提交:
    a1b2c3d 提交信息 1
    d4e5f6g 提交信息 2
```

## 🎯 常见工作流

### 日常开发流程

1. **启动守护进程**
   ```powershell
   .\start-git-sync.ps1 -Background
   ```

2. **编辑文件**
   - 正常编辑您的HTML、JS、CSS等文件
   - 无需手动执行git命令

3. **监控提交**
   ```powershell
   tail -f .git-sync.log
   ```

4. **停止守护进程**（如果需要）
   ```powershell
   .\stop-git-sync.ps1
   ```

### 紧急推送

如果需要立即推送（不等待30秒），可以手动执行：

```bash
git push origin master
```

守护进程会识别此提交并更新其状态。

## 📱 推送通知

您可以在GitHub上配置webhook或邮件通知，在代码推送后自动触发CI/CD流程：

1. 访问 https://github.com/loveyalee/yinhexingchen-finance-browser/settings/hooks
2. 添加webhook
3. 指定payload URL和事件类型

## 🔄 手动同步

如果需要完全手动控制，可以使用传统的git命令：

```bash
# 查看改动
git status

# 添加改动
git add -A

# 提交改动
git commit -m "Your commit message"

# 推送到GitHub
git push origin master
```

## 💡 最佳实践

1. **定期检查日志** - 确保没有推送失败的错误
2. **定期拉取更新** - 如果在其他设备修改代码，定期运行 `git pull`
3. **避免大文件** - 不要提交 > 100MB 的文件
4. **使用有意义的提交信息** - 虽然自动提交信息有时间戳，但可以手动修改
5. **备份重要数据** - 在 .env 等敏感文件中使用 .env.example 模板

## 🆘 获取帮助

- **查看日志**: `tail -f .git-sync.log`
- **检查git状态**: `git status`
- **检查日志差异**: `git log --oneline origin/master..HEAD`
- **手动推送**: `git push -v origin master`

## 📝 版本信息

- **创建时间**: 2026-04-18
- **版本**: 1.0.0
- **支持平台**: Windows (PowerShell), Linux, macOS

## 📖 更多信息

有关git的更多信息，请参考：
- [Git官方文档](https://git-scm.com/doc)
- [GitHub帮助](https://help.github.com)
- [GitHub 认证](https://docs.github.com/en/authentication)

---

**最后更新**: 2026-04-18
**维护者**: DevOps Team
