# 银河星辰桌面版发布说明

## 目标

面向 PC 用户发布 Windows 桌面安装版，并支持：

- 应用启动时自动检查更新
- 发现新版本后提示用户
- 后台下载更新包
- 用户立即安装，或在下次启动时自动安装

## 当前桌面端架构

当前采用的是更适合市场发布的方案：

- Electron 作为 Windows 桌面外壳
- 桌面端默认加载 `https://zonya.work/login.html`
- 业务页面、登录、注册、短信、用户数据仍由线上站点和服务器处理
- 桌面端只负责窗口、更新检查、安装更新

这意味着：

- 不需要把 `server.js` 和本地数据库能力一起塞进安装包
- 更适合快速发布和后续统一维护
- 用户安装后，业务更新走线上页面，客户端更新只处理外壳能力和桌面体验

## 已接入的骨架

- `main.js`
  - Electron 主进程
  - `electron-updater` 自动更新接线
  - 默认加载线上登录页
- `preload.js`
  - 暴露更新相关 IPC 能力
- `login.html`
  - 桌面端更新提示 UI
- `login.js`
  - 更新状态展示与下载/安装按钮逻辑
- `package.json`
  - `electron`
  - `electron-builder`
  - `electron-updater`
  - Windows NSIS 打包配置
- `download.html`
  - Windows 下载页

## 本地打包

先安装依赖：

```bash
npm install
```

启动桌面版调试：

```bash
npm run desktop
```

构建 Windows 安装包：

```bash
npm run dist:win
```

## 打包产物

默认输出目录：

```text
release/
```

核心发布物至少包括：

- `yinhexingchen-<version>.exe`
- `latest.yml`

## 线上发布目录

自动更新源已经配置为：

```text
https://zonya.work/releases/
```

因此你需要把发布物上传到服务器的静态目录，并保证对外可访问，例如：

- `https://zonya.work/releases/yinhexingchen-1.0.0.exe`
- `https://zonya.work/releases/latest.yml`

## 推荐发布流程

1. 修改 `package.json` 中的版本号
2. 执行 `npm run dist:win`
3. 上传 `release/` 下的新安装包和 `latest.yml`
4. 打开已安装的旧版本桌面端
5. 验证是否弹出“发现新版本”
6. 验证下载完成后是否支持“立即安装”或“下次启动安装”

如果使用本仓库提供的发布脚本，可直接执行：

```powershell
.\deploy-desktop-release.ps1
```

它会把以下文件上传到 `https://zonya.work/releases/`：

- `yinhexingchen-1.0.0.exe`
- `yinhexingchen-1.0.0.exe.blockmap`
- `latest.yml`

## 重要提醒

- 现在只是自动更新骨架，不代表已经完成市场发布
- 未做代码签名时，Windows SmartScreen 仍可能提示风险
- `zonya.work` 的 HTTPS 必须稳定，否则安装包下载和自动更新都会失败
- 发布前至少做一次真实升级测试：旧版本升级到新版本
- 由于桌面端默认加载线上站点，线上登录页和接口可用性会直接影响桌面端使用体验
