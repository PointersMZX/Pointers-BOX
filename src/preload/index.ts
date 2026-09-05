import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import type { DownloadEvent, PBoxApi, UpdateEvent } from '../shared/types'

function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api: PBoxApi = {
  getData: () => ipcRenderer.invoke('data:snapshot'),
  refreshData: (force?: boolean) => ipcRenderer.invoke('data:refresh', force),
  restoreData: (type) => ipcRenderer.invoke('data:restore', type),
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (patch) => ipcRenderer.invoke('config:set', patch),
  chooseDownloadDir: () => ipcRenderer.invoke('downloads:chooseDir'),
  hasActiveDownloads: () => ipcRenderer.invoke('downloads:hasActive'),
  openPath: (path) => ipcRenderer.invoke('shell:openPath', path),
  resetBrowserSession: () => ipcRenderer.invoke('browser:resetSession'),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onNavigate: (cb) => subscribe<string>('navigate', cb),
  onDownloadEvent: (cb) => subscribe<DownloadEvent>('download:event', cb),
  onUpdateEvent: (cb) => subscribe<UpdateEvent>('update:event', cb)
}

contextBridge.exposeInMainWorld('api', api)
