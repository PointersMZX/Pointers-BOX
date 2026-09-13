// 检查更新（PRD 4.4）：v2.1.0 双渠道（Gitee 国内镜像 / GitHub 全球官方）+ Win7 分流
import { app, shell } from 'electron'
import { autoUpdater } from 'electron-updater'
import { existsSync, mkdirSync, rmSync, statSync } from 'fs'
import { join } from 'path'
import os from 'os'
import { isNewerVersion } from '../shared/semver'
import type { UpdateCheckResult, UpdateEvent } from '../shared/types'
import { parseReleaseJson } from '../shared/updates'
import { isUpdateChannel, matchAssetByName, winCompatFromOsVersion, UPDATE_CHANNEL_INFO } from '../shared/updateChannels'
import { getConfig } from './configStore'
import { requestFile, requestText } from './netRequest'
import { getMainWindow } from './window'

const FETCH_TIMEOUT_MS = 10_000
const CHECK_TTL_MS = 10 * 60 * 1000

/** 当前是否 Win7/8 兼容构建（Electron 22）：决定分流渠道与 Gitee 资产匹配 */
function isWin7CompatBuild(): boolean {
  return winCompatFromOsVersion(process.platform, os.release()) ?? false
}

// 按渠道区分的 TTL 缓存（切换渠道后立即生效）
const lastResults = new Map<string, UpdateCheckResult>()
const lastCheckAt = new Map<string, number>()
// Gitee 渠道：最近一次命中的安装包直链（下载时使用，避免二次解析）
let lastGiteeAsset: { name: string; url: string; size?: number } | undefined
let lastGiteeVersion = ''
// Gitee 安装包落盘路径（installUpdate 用）
let downloadedInstaller: string | null = null

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
// 仅 GitHub 渠道（electron-updater 管线）会走到这些事件；Gitee 渠道进度在 downloadFromGitee 内广播
export function initUpdater(): void {
  // v2.3.0：macOS 未签名打包下 electron-updater 无法校验（需 codesign），先禁用应用内更新；
  // checkUpdate 的渠道 API 检查不受影响（macOS 用户仍能看到新版本并从发布页手动下载）
  if (process.platform === 'darwin') return
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

  // 打包版启动 30s 后静默检查（走 TTL 缓存，不打扰用户；未选渠道则跳过）
  if (app.isPackaged) {
    setTimeout(() => {
      void checkUpdate(false)
    }, 30_000).unref?.()
  }
}

export async function checkUpdate(force = true): Promise<UpdateCheckResult> {
  const current = app.getVersion()
  const channel = getConfig().updateChannel
  if (!isUpdateChannel(channel)) {
    return {
      current,
      latest: null,
      hasUpdate: false,
      error: '尚未选择更新渠道，请先在设置中选择'
    }
  }
  const info = UPDATE_CHANNEL_INFO[channel]
  const cacheKey = channel
  if (
    !force &&
    lastResults.has(cacheKey) &&
    Date.now() - (lastCheckAt.get(cacheKey) ?? 0) < CHECK_TTL_MS
  ) {
    return lastResults.get(cacheKey) as UpdateCheckResult
  }
  try {
    const { status, text } = await requestText(info.releaseApi, FETCH_TIMEOUT_MS, info.headers)
    if (status === 403) throw new Error('接口访问受限（限流），请稍后再试')
    if (status === 401) throw new Error('接口需要认证，请稍后再试')
    if (status === 404) throw new Error('未找到任何 Release')
    if (status < 200 || status >= 300) throw new Error(`HTTP ${status}`)
    const release = parseReleaseJson(text)
    if (!release) throw new Error('Release 数据缺少 tag_name')
    const result: UpdateCheckResult = {
      current,
      latest: release.tagName,
      hasUpdate: isNewerVersion(release.tagName, current),
      releaseUrl: release.htmlUrl ?? info.releasePage,
      releaseNotes: release.notes?.slice(0, 600)
    }
    // Gitee 渠道：记录命中的安装包直链（Win7 分流匹配）
    if (channel === 'gitee') {
      lastGiteeAsset =
        result.hasUpdate && release.assets
          ? matchAssetByName(release.assets, isWin7CompatBuild())
          : undefined
      lastGiteeVersion = release.tagName
      if (result.hasUpdate && !lastGiteeAsset) {
        result.error = '该 Release 未附带可用的 Windows 安装包'
      }
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

/** Gitee 渠道：直链流式下载安装包到 userData/updates/，进度走双通道 */
async function downloadFromGitee(): Promise<void> {
  if (!lastGiteeAsset) {
    // 兜底：checkUpdate 之后配置可能变化，重新拉一次
    const check = await checkUpdate(true)
    if (!check.hasUpdate || !lastGiteeAsset) {
      broadcast({ type: 'not-available' })
      return
    }
  }
  const asset = lastGiteeAsset
  const dest = join(updateDir(), `Pointers-BOX-Setup-${lastGiteeVersion || 'latest'}.exe`)
  rmSync(dest, { force: true })
  broadcast({ type: 'available', version: lastGiteeVersion })
  await requestFile(
    asset.url,
    dest,
    { 'User-Agent': 'Pointers-BOX-Updater' },
    (received, total, bytesPerSecond) => {
      const percent = total > 0 ? Math.min(100, (received / total) * 100) : 0
      broadcast({ type: 'progress', percent })
      getMainWindow()?.webContents.send('download:event', {
        type: 'progress',
        task: {
          id: 'app-update',
          filename: asset.name,
          path: '',
          received,
          total,
          percent,
          bytesPerSecond,
          paused: false,
          source: 'update'
        }
      })
    }
  )
  // 大小校验（assets 提供了 size 时）
  if (asset.size && asset.size > 0) {
    const actual = statSync(dest).size
    if (actual !== asset.size) {
      rmSync(dest, { force: true })
      throw new Error(`安装包大小校验失败（${actual} / ${asset.size}）`)
    }
  }
  downloadedInstaller = dest
  broadcast({ type: 'downloaded' })
}

export async function downloadUpdate(): Promise<void> {
  if (!app.isPackaged) {
    throw new Error('开发模式下不支持自动下载更新，请在打包安装版中使用')
  }
  const channel = getConfig().updateChannel
  if (!isUpdateChannel(channel)) {
    throw new Error('尚未选择更新渠道')
  }
  if (channel === 'gitee') {
    await downloadFromGitee()
    return
  }
  // v2.3.0：macOS 未签名包不支持应用内自动更新（electron-updater 需 codesign）
  if (process.platform === 'darwin') {
    throw new Error('macOS 版暂不支持应用内更新，请到发布页手动下载')
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
  if (downloadedInstaller && existsSync(downloadedInstaller)) {
    // Gitee 渠道：唤起 NSIS 安装器后退出
    void shell.openPath(downloadedInstaller)
    app.quit()
    return
  }
  autoUpdater.quitAndInstall(false, true)
}

/** 渠道切换后调用：清空 TTL 缓存，使下次检查立即拉新 */
export function invalidateUpdateCache(): void {
  lastResults.clear()
  lastCheckAt.clear()
  lastGiteeAsset = undefined
}
