const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');

let mainWindow = null;
let pendingUpdateInfo = null;
const desktopEntryUrl = process.env.DESKTOP_ENTRY_URL || 'https://zonya.work/login.html';

log.initialize();
autoUpdater.logger = log;
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

function sendUpdateEvent(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1120,
    minHeight: 760,
    title: '银河星辰财务浏览器',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadURL(desktopEntryUrl).catch(function() {
    mainWindow.loadFile('login.html');
  });
  mainWindow.on('closed', function() {
    mainWindow = null;
  });
}

function configureAutoUpdater() {
  autoUpdater.on('checking-for-update', function() {
    sendUpdateEvent('update:checking');
  });

  autoUpdater.on('update-available', function(info) {
    pendingUpdateInfo = info || null;
    sendUpdateEvent('update:available', {
      version: info && info.version ? info.version : '',
      releaseDate: info && info.releaseDate ? info.releaseDate : '',
      releaseNotes: info && info.releaseNotes ? info.releaseNotes : ''
    });
  });

  autoUpdater.on('update-not-available', function(info) {
    pendingUpdateInfo = null;
    sendUpdateEvent('update:not-available', {
      version: info && info.version ? info.version : app.getVersion()
    });
  });

  autoUpdater.on('download-progress', function(progress) {
    sendUpdateEvent('update:download-progress', {
      percent: progress && progress.percent ? Number(progress.percent.toFixed(1)) : 0,
      transferred: progress && progress.transferred ? progress.transferred : 0,
      total: progress && progress.total ? progress.total : 0
    });
  });

  autoUpdater.on('update-downloaded', function(info) {
    pendingUpdateInfo = info || pendingUpdateInfo;
    sendUpdateEvent('update:downloaded', {
      version: info && info.version ? info.version : ''
    });
  });

  autoUpdater.on('error', function(error) {
    sendUpdateEvent('update:error', {
      message: error ? error.message : '未知更新错误'
    });
  });
}

async function checkForUpdates() {
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    log.error('Failed to check for updates', error);
    sendUpdateEvent('update:error', {
      message: error ? error.message : '检查更新失败'
    });
  }
}

ipcMain.handle('update:get-state', function() {
  return {
    currentVersion: app.getVersion(),
    pendingVersion: pendingUpdateInfo && pendingUpdateInfo.version ? pendingUpdateInfo.version : ''
  };
});

ipcMain.handle('update:check-now', async function() {
  await checkForUpdates();
  return { ok: true };
});

ipcMain.handle('update:start-download', async function() {
  await autoUpdater.downloadUpdate();
  return { ok: true };
});

ipcMain.handle('update:install-now', async function() {
  const choice = await dialog.showMessageBox({
    type: 'question',
    buttons: ['立即安装并重启', '稍后'],
    defaultId: 0,
    cancelId: 1,
    title: '安装更新',
    message: '新版本已下载完成，是否现在退出并安装？'
  });

  if (choice.response === 0) {
    setImmediate(function() {
      autoUpdater.quitAndInstall(false, true);
    });
    return { accepted: true };
  }

  return { accepted: false };
});

app.whenReady().then(function() {
  configureAutoUpdater();
  createWindow();
  checkForUpdates();

  app.on('activate', function() {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function() {
  if (process.platform !== 'darwin') app.quit();
});
