// 安卓平台实现（开发计划 D6）：Capacitor 插件承载原生能力
import { Capacitor, CapacitorHttp, registerPlugin } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { REMOTE_URLS } from '../../../shared/types'
import type {
  AppConfig,
  DataSnapshot,
  RestoreTarget,
  UpdateCheckResult,
  UpdateEvent,
  UserLink
} from '../../../shared/types'
import {
  mergeBoxInfo,
  parseLooseJson,
  validateAnnouncement,
  validateBoxInfo,
  validateResources,
  validateVersionLogs
} from '../../../shared/validate'
import { EMBEDDED_BOX } from '../../../shared/embeddedBox'
import { withCacheBust } from '../../../shared/refresh'
import { normalizeConfig } from '../../../shared/config'
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
  // v2.3.1：Android 端无 node 文件系统，box 缺字段/获取失败时用包内嵌入常量做字段级兜底
  const box = mergeBoxInfo(EMBEDDED_BOX, validateBoxInfo(raw.box))
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
  // v2.3.2：强刷（下拉刷新）带时间戳参数击穿静态托管缓存，保证拿到最新内容
  const url = (u: string): string => (force ? withCacheBust(u) : u)
  const results = await Promise.allSettled([
    fetchLooseJson(url(REMOTE_URLS.resources)),
    fetchLooseJson(url(REMOTE_URLS.announcement)),
    fetchLooseJson(url(REMOTE_URLS.box)),
    fetchLooseJson(url(REMOTE_URLS.versionLogs))
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

  // 离线兜底：读取上次缓存（旧缓存可能缺字段，同样用嵌入值补齐）
  try {
    const { value } = await Preferences.get({ key: CACHE_KEY })
    if (value) {
      const cached = JSON.parse(value) as DataSnapshot
      return {
        ...cached,
        box: mergeBoxInfo(EMBEDDED_BOX, cached.box ?? null),
        offline: true,
        lastSync: cached.lastSync ?? null
      }
    }
  } catch {
    // 无缓存
  }
  const reason =
    resources && resources.status === 'rejected' ? String(resources.reason) : '网络不可用'
  return {
    data: emptyResourceData(),
    // v2.3.1：彻底离线（无缓存）时应用信息仍用包内嵌入值，不依赖网络
    box: EMBEDDED_BOX,
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

// 系统浏览器打开（v2.3.0：内嵌 WebView 浏览器已删除，全部链接自动跳转系统浏览器；
// 下载功能同步取消——如需下载请在系统浏览器内进行）
export async function androidOpenExternal(url: string): Promise<void> {
  await SystemBrowserNative.openExternal({ url })
}

// 安卓原生插件桥（android/app/src/main/java/cc/pointers/box/SystemBrowserPlugin.java）
interface SystemBrowserNativeInterface {
  openExternal(options: { url: string }): Promise<void>
}

const SystemBrowserNative = registerPlugin<SystemBrowserNativeInterface>('SystemBrowser')

// v2.4.0 分享功能：原生 Share 插件（android/.../SharePlugin.java）——
// 系统分享面板（ACTION_SEND）；无分享目标/拉起失败时原生侧已回落系统剪贴板
interface ShareNativeInterface {
  share(options: { text: string }): Promise<{ mode: 'shared' | 'copied' }>
  copyText(options: { text: string }): Promise<void>
}

const ShareNative = registerPlugin<ShareNativeInterface>('Share')

/** v2.4.0：安卓剪贴板复制（走原生系统剪贴板，避免 WebView clipboard API 的权限/secure context 问题） */
export async function androidCopyText(text: string): Promise<void> {
  await ShareNative.copyText({ text })
}

/**
 * v2.4.0：安卓原生分享。
 * 返回 'shared'=系统分享面板已拉起；'copied'=无分享目标或异常，已复制系统剪贴板（调用方给「已复制」反馈）。
 */
export async function androidShareText(text: string): Promise<'shared' | 'copied'> {
  try {
    const res = await ShareNative.share({ text })
    return res.mode === 'shared' ? 'shared' : 'copied'
  } catch {
    try {
      await ShareNative.copyText({ text })
    } catch {
      // 原生插件缺失（纯 web 环境）时的最后兜底
      try {
        await navigator.clipboard.writeText(text)
      } catch {
        /* 兜底全部失败：静默，UI 侧按已复制处理 */
      }
    }
    return 'copied'
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
export const ANDROID_APP_VERSION = '2.4.0'

export function isAndroidNative(): boolean {
  return Capacitor.isNativePlatform()
}
