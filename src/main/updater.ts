// 检查更新（PRD 4.4）：v2.1.0 双渠道（Gitee 国内镜像 / GitHub 全球官方）+ Win7 分流
// v2.6.0 调整：关闭 Gitee 与蓝奏云（单文件附件 100MB 上限，不适用于本多平台更新包）——仅 GitHub 全球官方渠道；
// 新增更新类型（stable 稳定版 / test 测试版=GitHub Pre 版本）+ 自动检测更新开关（启动后 5s 静默检测）
import { app, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import os from 'os'
import { isNewerVersion } from '../shared/semver'
import type { UpdateCheckResult, UpdateEvent } from '../shared/types'
import { ReleaseInfo, parseReleaseJson, pickNewestRelease } from '../shared/updates'
import { winCompatFromOsVersion, UPDATE_CHANNEL_INFO } from '../shared/updateChannels'
import { getConfig } from './configStore'
import { requestText } from './netRequest'
import { getMainWindow } from './window'

const FETCH_TIMEOUT_MS = 10_000
const CHECK_TTL_MS = 10 * 60 * 1000

/** 当前是否 Win7/8 兼容构建（Electron 22）：决定分流 electron-updater channel 与资产匹配 */
function isWin7CompatBuild(): boolean {
  return winCompatFromOsVersion(process.platform, os.release()) ?? false
}

// 按更新类型 + 渠道区分的 TTL 缓存（切换更新类型后立即失效）
const lastResults = new Map<string, UpdateCheckResult>()
const lastCheckAt = new Map<string, number>()

function broadcast(e: UpdateEvent): void {
  getMainWindow()?.webContents.send('update:event', e)
}

function updateDir(): string {
  const dir = join(app.getPath('userData'), 'updates')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

/** Win7 分流：electron-updater channel（读 latest-win7.yml 而非 latest.yml） */
function applyWinChannel(): void {
  autoUpdater.channel = isWin7CompatBuild() ? 'win7' : ''
}

// 接管更新包下载/安装事件；进度经 download:event 通道进入下载管理（PRD 7.4 末条）
// 仅 GitHub 渠道（electron-updater 管线）会走到这些事件
export function initUpdater(): void {
  // v2.6.0：应用内自动更新仅 Windows（macOS 未签名无法校验；Linux 统一手动下载替换 AppImage/deb）
  // ——非 Windows 仍可检查新版本（渠道 API 检查不受影响），从发布页手动获取
  if (process.platform !== 'win32') return
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  applyWinChannel()
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
        paused: false,
        source: 'update'
      }
    })
  })
  autoUpdater.on('update-downloaded', () => broadcast({ type: 'downloaded' }))
  autoUpdater.on('error', (e) => broadcast({ type: 'error', message: e?.message ?? String(e) }))

  // v2.6.0：启动自动检测由渲染层全局组件驱动（桌面/Android/鸿蒙同一套逻辑，
  // 检测到新版本后弹全局更新弹窗）；主进程不再重复起 5 秒定时器。
}

export async function checkUpdate(force = true): Promise<UpdateCheckResult> {
  const current = app.getVersion()
  const channel = getConfig().updateChannel
  // v2.6.0：网盘渠道无版本 API 检测（网盘为手动下载），直接返回手动下载提示
  if (channel === 'netdisk') {
    return { current, latest: null, hasUpdate: false, error: '网盘渠道为手动下载，请点「网盘更新」跳转网盘链接' }
  }
  // GitHub 渠道（v2.6.0：渠道固定 github，releaseApi 必有）
  const info = UPDATE_CHANNEL_INFO['github']
  // v2.6.0：更新类型（stable 稳定版 / test 测试版=GitHub Pre），缓存键含类型
  const type = getConfig().updateType ?? 'stable'
  const cacheKey = `github:${type}`
  if (
    !force &&
    lastResults.has(cacheKey) &&
    Date.now() - (lastCheckAt.get(cacheKey) ?? 0) < CHECK_TTL_MS
  ) {
    return lastResults.get(cacheKey) as UpdateCheckResult
  }
  try {
    let release: ReleaseInfo | null | undefined
    if (type === 'test') {
      // 测试版：正式版 + Pre 测试版都接受，取版本号最高的一个
      release = await fetchGitHubTestRelease()
    } else {
      // 稳定版：查 GitHub latest（渠道固定 github，releaseApi 必有）
      const { status, text } = await requestText(info.releaseApi!, FETCH_TIMEOUT_MS, info.headers)
      if (status < 200 || status >= 300) throw new Error(`HTTP ${status}`)
      const parsed = parseReleaseJson(text)
      if (!parsed) throw new Error('Release 数据缺少 tag_name')
      release = parsed
    }
    const result: UpdateCheckResult = {
      current,
      latest: release?.tagName ?? null,
      hasUpdate: release ? isNewerVersion(release.tagName, current) : false,
      releaseUrl: release?.htmlUrl ?? info.releasePage,
      releaseNotes: release?.notes?.slice(0, 600)
    }
    lastResults.set(cacheKey, result)
    lastCheckAt.set(cacheKey, Date.now())
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

/** GitHub 测试版（Pre）：拉 releases 列表，正式版与测试版都算，取版本号最高的一个
 *  （用户口径 v2.6.0：选「测试版」= 接受 Pre 更新，同时仍收正式版；无 Pre 时就是最新正式版） */
async function fetchGitHubTestRelease(): Promise<ReleaseInfo | null | undefined> {
  const url = 'https://api.github.com/repos/PointersMZX/Pointers-BOX/releases?per_page=100'
  const { status, text } = await requestText(url, FETCH_TIMEOUT_MS, UPDATE_CHANNEL_INFO['github'].headers)
  if (status < 200 || status >= 300) throw new Error(`HTTP ${status}`)
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Release 列表数据解析失败')
  }
  return pickNewestRelease(data)
}

export async function downloadUpdate(): Promise<void> {
  if (!app.isPackaged) {
    throw new Error('开发模式下不支持自动下载更新，请在打包安装版中使用')
  }
  // v2.6.0：仅 Windows 平台有应用内更新（macOS 未签名；Linux 手动替换 AppImage/deb）
  if (process.platform !== 'win32') {
    throw new Error('当前平台请到发布页手动下载最新版本')
  }
  // GitHub 渠道：electron-updater 管线（channel 已在 initUpdater 按 OS 设置）
  applyWinChannel()
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
  // v2.6.0：非 Windows 无应用内更新（同 downloadUpdate 守卫）
  if (process.platform !== 'win32') return
  autoUpdater.quitAndInstall(false, true)
}

/** 渠道固定、更新类型固定时无渠道切换：无缓存失效接口（类型/渠道变化已在 checkUpdate 内按缓存键区分） */
export function invalidateUpdateCache(): void {
  lastResults.clear()
  lastCheckAt.clear()
}
