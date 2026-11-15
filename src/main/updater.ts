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
import { ReleaseInfo, parseReleaseJson } from '../shared/updates'
import { winCompatFromOsVersion, UPDATE_CHANNEL_INFO } from '../shared/updateChannels'
import { getConfig } from './configStore'
import { requestText } from './netRequest'
import { getMainWindow } from './window'

const FETCH_TIMEOUT_MS = 10_000
const CHECK_TTL_MS = 10 * 60 * 1000
const AUTO_CHECK_DELAY_MS = 5_000
// GitHub 测试版（Pre）判定：tagName 含 pre 关键字（如 v1.0.0-PRE、v2.5.0-pre）
const PRE_TAG_RE = /pre/i

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

  // v2.6.0：自动检测更新开关——启用后每次启动约 5 秒后静默检测版本（TTL 缓存，不打扰用户）
  if (app.isPackaged) {
    if (getConfig().autoCheckUpdate) {
      setTimeout(() => {
        void checkUpdate(false)
      }, AUTO_CHECK_DELAY_MS).unref?.()
    }
  }
}

export async function checkUpdate(force = true): Promise<UpdateCheckResult> {
  const current = app.getVersion()
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
      // 测试版：GitHub Pre 版本——拉全部 releases，取最新的 Pre 标签
      release = await fetchGitHubTestRelease()
    } else {
      const { status, text } = await requestText(info.releaseApi, FETCH_TIMEOUT_MS, info.headers)
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

/** GitHub 测试版（Pre）：拉 releases 列表，取最新的 Pre 标签（按发布时间倒序） */
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
  const items = Array.isArray(data) ? data : []
  // 筛选 Pre 标签（tagName 含 pre 关键字）
  const preItems = items.filter((it) => {
    const tag = (it as Record<string, unknown>)['tag_name']
    return typeof tag === 'string' && PRE_TAG_RE.test(tag)
  })
  if (preItems.length === 0) return null // 尚无测试版（Pre）
  // 按发布时间倒序，取最新一个
  preItems.sort((a, b) => {
    const ca = (a as Record<string, unknown>)['created_at'] as string | undefined
    const cb = (b as Record<string, unknown>)['created_at'] as string | undefined
    if (ca && cb) return cb > ca ? -1 : 1
    return 0
  })
  // 用单个 release 对象解析（与 parseReleaseJson 一致）
  return parseReleaseJson(JSON.stringify(preItems[0])) as ReleaseInfo | null
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
