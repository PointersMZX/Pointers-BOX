import { app, dialog, ipcMain, shell } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { AppConfig, RestoreTarget } from '../shared/types'
import { getConfig, setConfig } from './configStore'
import { getSnapshot, refreshRemote, restoreFromFile } from './dataStore'
import { getUserLinks, setUserLinks } from './linksStore'
import { sanitizeUserLinks, mergeUserLinks } from '../shared/userLinks'
import { hasActiveDownloads, cancelDownload, pauseDownload, resumeDownload } from './downloads'
import { resetBrowserSession } from './sessions'
import { listHistory, clearHistory } from './history'
import { checkUpdate, downloadUpdate, installUpdate, invalidateUpdateCache } from './updater'

export function registerIpcHandlers(): void {
  // 本地应用版本（v2.0.0：状态栏/设置页显示本地版本，而非远程 box.json 的 app_version）
  ipcMain.handle('app:version', () => app.getVersion())

  // 数据（M1）
  ipcMain.handle('data:snapshot', () => getSnapshot())
  ipcMain.handle('data:refresh', (_e, force?: unknown) => refreshRemote(Boolean(force)))
  ipcMain.handle('data:restore', (_e, target: unknown) =>
    restoreFromFile(
      target === 'box' ? ('box' as RestoreTarget) : ('resources' as RestoreTarget)
    )
  )

  // 配置导出/导入（v2.0.0：主题/路径/收藏等一键迁移）
  ipcMain.handle('config:export', async () => {
    const picked = await dialog.showSaveDialog({
      title: '导出配置',
      defaultPath: join(app.getPath('documents'), 'pointers-box-config.json'),
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (picked.canceled || !picked.filePath) return null
    try {
      writeFileSync(picked.filePath, JSON.stringify({ app: 'pointers-box', exportedAt: Date.now(), config: getConfig() }, null, 2), 'utf-8')
      return picked.filePath
    } catch {
      return null
    }
  })
  ipcMain.handle('config:import', async () => {
    const picked = await dialog.showOpenDialog({
      title: '导入配置',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (picked.canceled || picked.filePaths.length === 0) return null
    try {
      const raw = JSON.parse(readFileSync(picked.filePaths[0] ?? '', 'utf-8')) as Record<string, unknown>
      const cfg = (typeof raw['config'] === 'object' && raw['config'] !== null ? raw['config'] : raw) as Partial<AppConfig>
      return setConfig(cfg)
    } catch {
      return null
    }
  })

  // 下载历史（v2.0.0：keepDownloadHistory 开关开启时记录）
  ipcMain.handle('history:list', () => listHistory())
  ipcMain.handle('history:clear', () => clearHistory())

  // 用户自建资源链接（v2.2.0：仅存本地 user-links.json）
  ipcMain.handle('links:get', () => getUserLinks())
  ipcMain.handle('links:set', (_e, links: unknown) => setUserLinks(links))
  ipcMain.handle('links:import', async () => {
    const picked = await dialog.showOpenDialog({
      title: '导入链接',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (picked.canceled || picked.filePaths.length === 0) return null
    try {
      const raw = JSON.parse(readFileSync(picked.filePaths[0] ?? '', 'utf-8')) as Record<string, unknown>
      // 兼容两种导入格式：裸数组 或 { links: [...] } 导出格式
      const incoming = sanitizeUserLinks(Array.isArray(raw) ? raw : raw['links'])
      const { merged, added, skipped } = mergeUserLinks(getUserLinks(), incoming)
      setUserLinks(merged)
      return { added, skipped }
    } catch {
      return null
    }
  })
  ipcMain.handle('links:export', async () => {
    const picked = await dialog.showSaveDialog({
      title: '导出链接',
      defaultPath: join(app.getPath('documents'), 'pointers-box-links.json'),
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (picked.canceled || !picked.filePath) return null
    try {
      writeFileSync(
        picked.filePath,
        JSON.stringify({ app: 'pointers-box', exportedAt: Date.now(), links: getUserLinks() }, null, 2),
        'utf-8'
      )
      return picked.filePath
    } catch {
      return null
    }
  })

  // 配置（M1）
  ipcMain.handle('config:get', () => getConfig())
  ipcMain.handle('config:set', (_e, patch: unknown) => {
    const prevChannel = getConfig().updateChannel
    const next = setConfig(
      (typeof patch === 'object' && patch !== null ? patch : {}) as Partial<AppConfig>
    )
    // v2.1.0：更新渠道切换后清空检查缓存，立即生效
    if (prevChannel !== next.updateChannel) invalidateUpdateCache()
    return next
  })

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

  // 任务控制（取消/暂停/恢复）：仅浏览器下载可控制，更新包由 updater 管理
  ipcMain.handle('downloads:cancel', (_e, id: unknown) => cancelDownload(String(id ?? '')))
  ipcMain.handle('downloads:pause', (_e, id: unknown) => pauseDownload(String(id ?? '')))
  ipcMain.handle('downloads:resume', (_e, id: unknown) => resumeDownload(String(id ?? '')))

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
