// 安卓平台实现（开发计划 D6）：Capacitor 插件承载原生能力
import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { REMOTE_URLS } from '../../../shared/types'
import type {
  AppConfig,
  DataSnapshot,
  DownloadEvent,
  RestoreTarget,
  UpdateCheckResult,
  UpdateEvent,
  UserLink
} from '../../../shared/types'
import {
  parseLooseJson,
  validateAnnouncement,
  validateBoxInfo,
  validateResources,
  validateVersionLogs
} from '../../../shared/validate'
import { normalizeConfig } from '../../../shared/config'
import { resolveOpenMode } from '../../../shared/browserChoice'
import { isNewerVersion } from '../../../shared/semver'
import { parseReleaseJson } from '../../../shared/updates'
import { isUpdateChannel, UPDATE_CHANNEL_INFO } from '../../../shared/updateChannels'
import { sanitizeUserLinks } from '../../../shared/userLinks'

const CONFIG_KEY = 'app-config'
const CACHE_KEY = 'data-cache'
const LINKS_KEY = 'user-links'
const DEFAULT_ANDROID_DOWNLOAD_DIR = '/storage/emulated/0/Download'

function emptyResourceData(): { resources: never[]; version_logs: never[]; announcement: null } {
  return { resources: [], version_logs: [], announcement: null }
}

async function fetchLooseJson(url: string): Promise<unknown> {
  const res = await CapacitorHttp.get({
    url,
    connectTimeout: 10_000,
    readTimeout: 10_000
  })
  if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`)
  // CapacitorHttp 可能已自动解析 JSON，也可能返回文本
  if (typeof res.data === 'string') return parseLooseJson(res.data)
  return res.data
}

function buildSnapshot(raw: {
  resources: unknown
  announcement: unknown
  box: unknown
  versionLogs: unknown
}): DataSnapshot {
  const clean = validateResources(raw.resources)
  const box = validateBoxInfo(raw.box)
  const versionLogs = validateVersionLogs(raw.versionLogs)
  return {
    data: {
      resources: clean.valid,
      version_logs: [],
      // v2.2.0：公告独立文件（announcement），不再从 resources 里读
      announcement: validateAnnouncement(raw.announcement)
    },
    box,
    versionLogs,
    offline: false,
    lastSync: Date.now(),
    warnings: clean.errors
  }
}

export async function androidGetData(force = false): Promise<DataSnapshot> {
  void force
  const results = await Promise.allSettled([
    fetchLooseJson(REMOTE_URLS.resources),
    fetchLooseJson(REMOTE_URLS.announcement),
    fetchLooseJson(REMOTE_URLS.box),
    fetchLooseJson(REMOTE_URLS.versionLogs)
  ])
  const resources = results[0]
  const announcement = results[1]
  const box = results[2]
  const logs = results[3]

  if (resources && resources.status === 'fulfilled') {
    const snapshot = buildSnapshot({
      resources: resources.value,
      announcement:
        announcement && announcement.status === 'fulfilled' ? announcement.value : null,
      box: box && box.status === 'fulfilled' ? box.value : null,
      versionLogs: logs && logs.status === 'fulfilled' ? logs.value : null
    })
    try {
      await Preferences.set({ key: CACHE_KEY, value: JSON.stringify(snapshot) })
    } catch {
      // 缓存失败不影响展示
    }
    return snapshot
  }

  // 离线兜底：读取上次缓存
  try {
    const { value } = await Preferences.get({ key: CACHE_KEY })
    if (value) {
      const cached = JSON.parse(value) as DataSnapshot
      return { ...cached, offline: true, lastSync: cached.lastSync ?? null }
    }
  } catch {
    // 无缓存
  }
  const reason =
    resources && resources.status === 'rejected' ? String(resources.reason) : '网络不可用'
  return {
    data: emptyResourceData(),
    box: null,
    versionLogs: [],
    offline: true,
    lastSync: null,
    warnings: [`资源数据获取失败：${reason}`]
  }
}

export async function androidGetConfig(): Promise<AppConfig> {
  const { value } = await Preferences.get({ key: CONFIG_KEY })
  let raw: unknown = null
  if (value) {
    try {
      raw = JSON.parse(value)
    } catch {
      raw = null
    }
  }
  return normalizeConfig(raw, DEFAULT_ANDROID_DOWNLOAD_DIR)
}

export async function androidSetConfig(patch: Partial<AppConfig>): Promise<AppConfig> {
  const next = { ...(await androidGetConfig()), ...patch }
  await Preferences.set({ key: CONFIG_KEY, value: JSON.stringify(next) })
  return next
}

export { resolveOpenMode }

// 用户自建资源链接（v2.2.0）：存 Preferences，与桌面端同构
export async function androidGetUserLinks(): Promise<UserLink[]> {
  try {
    const { value } = await Preferences.get({ key: LINKS_KEY })
    if (!value) return []
    return sanitizeUserLinks(JSON.parse(value))
  } catch {
    return []
  }
}

export async function androidSetUserLinks(links: unknown): Promise<UserLink[]> {
  const next = sanitizeUserLinks(links)
  await Preferences.set({ key: LINKS_KEY, value: JSON.stringify(next) })
  return next
}

// 文件导入/导出依赖系统文件选择器，Android 端暂不支持（返回 null，UI 隐藏按钮）
export async function androidImportUserLinks(): Promise<{ added: number; skipped: number } | null> {
  return null
}

export async function androidExportUserLinks(): Promise<string | null> {
  return null
}

// 内置浏览器：打开安卓原生 InAppBrowserActivity（带地址栏/导航/下载/会话重置）
export async function androidOpenClaim(url: string, choice?: 'builtin' | 'system'): Promise<void> {
  const mode = resolveOpenMode(choice, 'android')
  if (mode === 'system-browser') {
    await androidOpenExternal(url)
    return
  }
  await InAppBrowserNative.open({ url })
}

// 会话重置：清空安卓 WebView 的 Cookie 与缓存
export async function androidResetSession(): Promise<void> {
  await InAppBrowserNative.resetSession()
}

// 打开系统下载记录（下载由系统 DownloadManager 接管）
export async function androidOpenSystemDownloads(): Promise<void> {
  await InAppBrowserNative.openSystemDownloads()
}

// 系统浏览器打开
export async function androidOpenExternal(url: string): Promise<void> {
  await InAppBrowserNative.openExternal({ url })
}

// 安卓原生插件桥（android/app/src/main/java/cc/pointers/box/InAppBrowserPlugin.java）
interface InAppBrowserNativeInterface {
  open(options: { url: string }): Promise<void>
  resetSession(): Promise<void>
  openSystemDownloads(): Promise<void>
  openExternal(options: { url: string }): Promise<void>
}

const InAppBrowserNative = registerPlugin<InAppBrowserNativeInterface>('InAppBrowser')

// v2.2.0：安卓下载事件桥接 —— InAppBrowserActivity 的下载（DownloadManager/blob 转系统浏览器）
// 经 DownloadEventBus → InAppBrowserPlugin.notifyListeners('downloadEvent') 回传，这里转成渲染层 DownloadEvent。
// started/done 映射为 DownloadTask；DownloadManager 无实时进度回传，percent 置 100（与桌面语义：完成即消失一致）。
export function androidOnDownloadEvent(cb: (e: DownloadEvent) => void): () => void {
  const plugin = InAppBrowserNative as unknown as {
    startDownloadWatch?(): Promise<void>
    stopDownloadWatch?(): Promise<void>
    addListener?(ev: string, cb: (r: unknown) => void): { remove(): Promise<void> } | undefined
  }

  let removed = false
  const taskFrom = (filename: string, total: number, done: boolean) => ({
    id: 'android-' + filename,
    filename,
    path: DEFAULT_ANDROID_DOWNLOAD_DIR + '/' + filename,
    received: done ? total : 0,
    total: total > 0 ? total : 0,
    percent: done ? 100 : 0,
    bytesPerSecond: 0,
    paused: false,
    source: 'browser' as const
  })

  void plugin.startDownloadWatch?.()
  const sub = plugin.addListener
    ? plugin.addListener('downloadEvent', (r) => {
        if (removed) return
        const ev = (r as { event?: { type?: string; filename?: string; total?: number } }).event
        if (!ev || !ev.type || !ev.filename) return
        if (ev.type === 'started') {
          cb({ type: 'started', task: taskFrom(ev.filename, ev.total ?? 0, false) })
        } else if (ev.type === 'done') {
          cb({ type: 'progress', task: taskFrom(ev.filename, 0, true) })
          cb({ type: 'done', id: 'android-' + ev.filename, state: 'completed' })
        } else if (ev.type === 'failed') {
          cb({ type: 'done', id: 'android-' + ev.filename, state: 'interrupted' })
        }
      })
    : undefined
  void sub

  return () => {
    removed = true
    void sub?.remove()
    void plugin.stopDownloadWatch?.()
  }
}

export function androidOnUpdateEvent(cb: (e: UpdateEvent) => void): () => void {
  void cb
  return () => {}
}

export function androidOnNavigate(cb: (page: string) => void): () => void {
  void cb
  return () => {}
}

export function androidRestoreData(_target: RestoreTarget): Promise<boolean> {
  void _target
  return Promise.resolve(false)
}

// v2.1.0：真实检查更新（按所选渠道拉 Release API + 版本比较）
export async function androidCheckUpdate(): Promise<UpdateCheckResult> {
  const current = ANDROID_APP_VERSION
  try {
    const channel = (await androidGetConfig()).updateChannel
    if (!isUpdateChannel(channel)) {
      return { current, latest: null, hasUpdate: false, error: '尚未选择更新渠道，请先在设置中选择' }
    }
    const info = UPDATE_CHANNEL_INFO[channel]
    const res = await CapacitorHttp.get({
      url: info.releaseApi,
      headers: info.headers,
      connectTimeout: 10_000,
      readTimeout: 10_000
    })
    const status = res.status ?? 0
    if (status === 403 || status === 401) {
      return { current, latest: null, hasUpdate: false, error: '接口访问受限（限流），请稍后再试' }
    }
    if (status < 200 || status >= 300) {
      return { current, latest: null, hasUpdate: false, error: `HTTP ${status}` }
    }
    const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
    const release = parseReleaseJson(text)
    if (!release) {
      return { current, latest: null, hasUpdate: false, error: 'Release 数据缺少 tag_name' }
    }
    return {
      current,
      latest: release.tagName,
      hasUpdate: isNewerVersion(release.tagName, current),
      releaseUrl: release.htmlUrl ?? info.releasePage,
      releaseNotes: release.notes?.slice(0, 600)
    }
  } catch (e) {
    return { current, latest: null, hasUpdate: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Android 应用版本（与 android/app/build.gradle versionName 同步维护） */
export const ANDROID_APP_VERSION = '2.2.0'

export function isAndroidNative(): boolean {
  return Capacitor.isNativePlatform()
}
