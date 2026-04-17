const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, data) => {
    ipcRenderer.send(channel, data);
  },
  receive: (channel, func) => {
    ipcRenderer.on(channel, (event, ...args) => func(...args));
  },
  updates: {
    getState: () => ipcRenderer.invoke('update:get-state'),
    checkNow: () => ipcRenderer.invoke('update:check-now'),
    startDownload: () => ipcRenderer.invoke('update:start-download'),
    installNow: () => ipcRenderer.invoke('update:install-now'),
    onChecking: (handler) => ipcRenderer.on('update:checking', () => handler()),
    onAvailable: (handler) => ipcRenderer.on('update:available', (event, payload) => handler(payload)),
    onNotAvailable: (handler) => ipcRenderer.on('update:not-available', (event, payload) => handler(payload)),
    onProgress: (handler) => ipcRenderer.on('update:download-progress', (event, payload) => handler(payload)),
    onDownloaded: (handler) => ipcRenderer.on('update:downloaded', (event, payload) => handler(payload)),
    onError: (handler) => ipcRenderer.on('update:error', (event, payload) => handler(payload))
  }
});
