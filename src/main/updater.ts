// 检查更新（PRD 4.4）：GitHub Release API 查询 + electron-updater 接管下载安装
import { app } from 'electron'
import { autoUpdater } from 'electron-updater'
import { isNewerVersion } from '../shared/semver'
import type { UpdateCheckResult, UpdateEvent } from '../shared/types'
import { parseReleaseJson } from '../shared/updates'
import { requestText } from './netRequest'
import { getMainWindow } from './window'

const RELEASE_API = 'https://api.github.com/repos/PointersMZX/Pointers-BOX/releases/latest'
const FETCH_TIMEOUT_MS = 10_000
const CHECK_TTL_MS = 10 * 60 * 1000

let lastResult: UpdateCheckResult | null = null
let lastCheckAt = 0

function broadcast(e: UpdateEvent): void {
  getMainWindow()?.webContents.send('update:event', e)
}

// 接管更新包下载/安装事件；进度经 download:event 通道进入下载管理（PRD 7.4 末条）
export function initUpdater(): void {
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('update-available', (info) =>
    broadcast({ type: 'available', version: info?.version ?? '' })
  )
  autoUpdater.on('update-not-available', () => broadcast({ type: 'not-available' }))
  autoUpdater.on('download-progress', (progress) => {
    broadcast({ type: 'progress', percent: progress.percent })
    getMainWindow()?.webContents.send('download:event', {
      type: 'progress',
      task: {
        id: 'app-update',
        filename: 'Pointers-BOX 更新包',
        path: '',
        received: progress.transferred,
        total: progress.total,
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        source: 'update'
      }
    })
  })
  autoUpdater.on('update-downloaded', () => broadcast({ type: 'downloaded' }))
  autoUpdater.on('error', (e) => broadcast({ type: 'error', message: e?.message ?? String(e) }))

  // 打包版启动 30s 后静默检查（走 TTL 缓存，不打扰用户）
  if (app.isPackaged) {
    setTimeout(() => {
      void checkUpdate(false)
    }, 30_000).unref?.()
  }
}

export async function checkUpdate(force = true): Promise<UpdateCheckResult> {
  const current = app.getVersion()
  if (!force && lastResult && Date.now() - lastCheckAt < CHECK_TTL_MS) {
    return lastResult
  }
  try {
    const { status, text } = await requestText(RELEASE_API, FETCH_TIMEOUT_MS, {
      'User-Agent': 'Pointers-BOX-Updater',
      Accept: 'application/vnd.github+json'
    })
    if (status === 403) throw new Error('GitHub API 限流，请稍后再试')
    if (status < 200 || status >= 300) throw new Error(`HTTP ${status}`)
    const release = parseReleaseJson(text)
    if (!release) throw new Error('Release 数据缺少 tag_name')
    const result: UpdateCheckResult = {
      current,
      latest: release.tagName,
      hasUpdate: isNewerVersion(release.tagName, current),
      releaseUrl: release.htmlUrl,
      releaseNotes: release.notes?.slice(0, 600)
    }
    lastResult = result
    lastCheckAt = Date.now()
    return result
  } catch (e) {
    return {
      current,
      latest: null,
      hasUpdate: false,
      error: e instanceof Error ? e.message : String(e)
    }
  }
}

export async function downloadUpdate(): Promise<void> {
  if (!app.isPackaged) {
    throw new Error('开发模式下不支持自动下载更新，请在打包安装版中使用')
  }
  // 先让 electron-updater 刷新内部状态，再触发下载
  const res = await autoUpdater.checkForUpdates()
  const remoteVersion = res?.updateInfo?.version
  if (remoteVersion && remoteVersion !== app.getVersion()) {
    await autoUpdater.downloadUpdate()
  } else {
    broadcast({ type: 'not-available' })
  }
}

export function installUpdate(): void {
  if (!app.isPackaged) return
  autoUpdater.quitAndInstall(false, true)
}
