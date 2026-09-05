import { dialog, ipcMain, shell } from 'electron'
import { existsSync, mkdirSync } from 'fs'
import type { AppConfig, RestoreTarget } from '../shared/types'
import { getConfig, setConfig } from './configStore'
import { getSnapshot, refreshRemote, restoreFromFile } from './dataStore'
import { hasActiveDownloads } from './downloads'
import { resetBrowserSession } from './sessions'
import { checkUpdate, downloadUpdate, installUpdate } from './updater'

export function registerIpcHandlers(): void {
  // 数据（M1）
  ipcMain.handle('data:snapshot', () => getSnapshot())
  ipcMain.handle('data:refresh', (_e, force?: unknown) => refreshRemote(Boolean(force)))
  ipcMain.handle('data:restore', (_e, target: unknown) =>
    restoreFromFile(
      target === 'box' ? ('box' as RestoreTarget) : ('resources' as RestoreTarget)
    )
  )

  // 配置（M1）
  ipcMain.handle('config:get', () => getConfig())
  ipcMain.handle('config:set', (_e, patch: unknown) =>
    setConfig((typeof patch === 'object' && patch !== null ? patch : {}) as Partial<AppConfig>)
  )

  // 内置浏览器（M5）：重置会话（清空 Cookie 与登录状态）
  ipcMain.handle('browser:resetSession', () => resetBrowserSession())

  // 下载管理（M6）：下载中锁定路径（PRD 4.3）
  ipcMain.handle('downloads:chooseDir', async () => {
    if (hasActiveDownloads()) return null
    const picked = await dialog.showOpenDialog({
      title: '选择下载目录',
      properties: ['openDirectory', 'createDirectory']
    })
    if (picked.canceled || picked.filePaths.length === 0) return null
    const dir = picked.filePaths[0] ?? ''
    if (!dir) return null
    setConfig({ downloadDir: dir })
    return dir
  })
  ipcMain.handle('downloads:hasActive', () => hasActiveDownloads())

  // 打开目录（下载管理「打开文件夹」）
  ipcMain.handle('shell:openPath', async (_e, path: unknown) => {
    if (typeof path !== 'string' || path.trim() === '') return false
    try {
      if (!existsSync(path)) mkdirSync(path, { recursive: true })
    } catch {
      // 打开时目录不存在则直接交给系统处理
    }
    const err = await shell.openPath(path)
    return err === ''
  })

  // 检查更新（M7）
  ipcMain.handle('update:check', () => checkUpdate(true))
  ipcMain.handle('update:download', () => downloadUpdate())
  ipcMain.handle('update:install', () => {
    installUpdate()
    return true
  })
}
