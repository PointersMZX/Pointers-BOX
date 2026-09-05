"use strict";
const electron = require("electron");
function subscribe(channel, cb) {
  const listener = (_event, payload) => cb(payload);
  electron.ipcRenderer.on(channel, listener);
  return () => {
    electron.ipcRenderer.removeListener(channel, listener);
  };
}
const api = {
  getData: () => electron.ipcRenderer.invoke("data:snapshot"),
  refreshData: (force) => electron.ipcRenderer.invoke("data:refresh", force),
  restoreData: (type) => electron.ipcRenderer.invoke("data:restore", type),
  getConfig: () => electron.ipcRenderer.invoke("config:get"),
  setConfig: (patch) => electron.ipcRenderer.invoke("config:set", patch),
  chooseDownloadDir: () => electron.ipcRenderer.invoke("downloads:chooseDir"),
  hasActiveDownloads: () => electron.ipcRenderer.invoke("downloads:hasActive"),
  openPath: (path) => electron.ipcRenderer.invoke("shell:openPath", path),
  resetBrowserSession: () => electron.ipcRenderer.invoke("browser:resetSession"),
  checkUpdate: () => electron.ipcRenderer.invoke("update:check"),
  downloadUpdate: () => electron.ipcRenderer.invoke("update:download"),
  installUpdate: () => electron.ipcRenderer.invoke("update:install"),
  onNavigate: (cb) => subscribe("navigate", cb),
  onDownloadEvent: (cb) => subscribe("download:event", cb),
  onUpdateEvent: (cb) => subscribe("update:event", cb)
};
electron.contextBridge.exposeInMainWorld("api", api);
