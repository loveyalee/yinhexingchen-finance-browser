# GitHub 实时同步 - 快速开始

## ✨ 一句话介绍

您的代码现在可以自动同步到GitHub！修改文件后，守护进程会自动提交和推送。

## 🚀 立即开始

### Windows (PowerShell)
```powershell
cd /e/yinhexingchen
.\start-git-sync.ps1 -Background
```

### Linux/Mac
```bash
cd /e/yinhexingchen
chmod +x start-git-sync.sh
./start-git-sync.sh
```

## 📋 工作流程

```
修改文件
    ↓
守护进程每5秒检查一次
    ↓
发现改动 → 自动 git add/commit
    ↓
每30秒推送一次到 GitHub
    ↓
✅ 完成！代码已同步
```

## 🛑 停止同步

### Windows
```powershell
.\stop-git-sync.ps1
```

### Linux/Mac
```bash
./stop-git-sync.sh
```

## 📊 监控

查看实时日志（实时更新）：
```bash
tail -f .git-sync.log
```

## 🔍 验证

检查是否有未推送的提交：
```bash
git log --oneline origin/master..HEAD
```

## ⚙️ 配置

修改以下文件进行自定义：
- `git-sync.config.json` - 修改监视间隔、推送频率等

## 📚 详细指南

查看完整文档：[GIT_SYNC_SETUP.md](GIT_SYNC_SETUP.md)

## 🎯 特点

✅ 全自动 - 无需手动git命令
✅ 实时 - 5秒检查，30秒推送
✅ 可靠 - 推送失败自动重试
✅ 日志 - 完整的操作日志
✅ 跨平台 - Windows、Linux、Mac都支持

## 💡 常见问题

**Q: 守护进程会减慢电脑速度吗？**
A: 不会。它只是每5秒检查一次文件，占用资源很少。

**Q: 可以修改自动提交信息吗？**
A: 可以。提交后手动修改：`git commit --amend -m "新消息"`

**Q: 如果网络断开会怎样？**
A: 守护进程会自动重试，连接恢复后继续推送。

**Q: 需要输入GitHub密码吗？**
A: 第一次可能需要。之后可以配置凭证缓存或使用SSH密钥。

---

**更多帮助**: 查看 [GIT_SYNC_SETUP.md](GIT_SYNC_SETUP.md)
