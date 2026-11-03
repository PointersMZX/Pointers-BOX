// 鸿蒙壳平台实现（v2.6.0 Phase 3）：ArkWeb 壳以纯 Web 模式承载渲染层，
// 数据链路 = 原生 fetch 直连服务器 .mcx（与 Android 的 CapacitorHttp 版同构）。
// 原生桥（Preferences/剪贴板/分享/下载）为后续增量；本文件先以 localStorage + Web API 全量兜底。
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
  mergeBoxInfo,
  parseLooseJson,
  validateAnnouncement,
  validateBoxInfo,
  validateResources,
  validateVersionLogs
} from '../../../shared/validate'
import { openMuxed } from '../../../shared/mcx'
import { EMBEDDED_BOX } from '../../../shared/embeddedBox'
import { withCacheBust } from '../../../shared/refresh'
import { normalizeConfig } from '../../../shared/config'
import { isNewerVersion } from '../../../shared/semver'
import { parseReleaseJson } from '../../../shared/updates'
import { isUpdateChannel, UPDATE_CHANNEL_INFO } from '../../../shared/updateChannels'
import { sanitizeUserLinks } from '../../../shared/userLinks'
import { buildSnapshot, emptyResourceData } from './capacitor'

const CONFIG_KEY = 'pbox-harmony-config'
const CACHE_KEY = 'pbox-harmony-data-cache'
const LINKS_KEY = 'pbox-harmony-user-links'
// 鸿蒙侧下载目录为展示值（下载能力为后续原生桥增量）
const DEFAULT_HARMONY_DOWNLOAD_DIR = '/storage/emulated/0/Download'
/** 鸿蒙壳版本（与 harmony/AppScope/app.json5 versionName 同步维护） */
export const HARMONY_APP_VERSION = '2.6.0'

function lsGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function lsSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // 存储失败不影响主流程
  }
}

async function fetchLooseWeb(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: 'no-cache' })
  if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  // .mcx 以纯文本（base64）回来时 openMuxed 自动识别/解密
  return parseLooseJson(openMuxed(text))
}

export async function harmonyGetData(force = false): Promise<DataSnapshot> {
  const url = (u: string): string => (force ? withCacheBust(u) : u)
  const results = await Promise.allSettled([
    fetchLooseWeb(url(REMOTE_URLS.resources)),
    fetchLooseWeb(url(REMOTE_URLS.announcement)),
    fetchLooseWeb(url(REMOTE_URLS.box)),
    fetchLooseWeb(url(REMOTE_URLS.versionLogs))
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
    lsSet(CACHE_KEY, JSON.stringify(snapshot))
    return snapshot
  }

  // 离线兜底：localStorage 缓存（同 Android 的 Preferences 模式）
  const cachedRaw = lsGet(CACHE_KEY)
  if (cachedRaw) {
    try {
      const cached = JSON.parse(cachedRaw) as DataSnapshot
      return {
        ...cached,
        box: mergeBoxInfo(EMBEDDED_BOX, cached.box ?? null),
        offline: true,
        lastSync: cached.lastSync ?? null
      }
    } catch {
      // 缓存损坏按无缓存处理
    }
  }
  const reason =
    resources && resources.status === 'rejected' ? String(resources.reason) : '网络不可用'
  return {
    data: emptyResourceData(),
    box: EMBEDDED_BOX,
    versionLogs: [],
    offline: true,
    lastSync: null,
    warnings: [`资源数据获取失败：${reason}`]
  }
}

export async function harmonyGetConfig(): Promise<AppConfig> {
  const raw = lsGet(CONFIG_KEY)
  let parsed: unknown = null
  if (raw) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }
  }
  return normalizeConfig(parsed, DEFAULT_HARMONY_DOWNLOAD_DIR)
}

export async function harmonySetConfig(patch: Partial<AppConfig>): Promise<AppConfig> {
  const next = { ...(await harmonyGetConfig()), ...patch }
  lsSet(CONFIG_KEY, JSON.stringify(next))
  return next
}

export async function harmonyGetUserLinks(): Promise<UserLink[]> {
  const raw = lsGet(LINKS_KEY)
  if (!raw) return []
  try {
    return sanitizeUserLinks(JSON.parse(raw))
  } catch {
    return []
  }
}

export async function harmonySetUserLinks(links: unknown): Promise<UserLink[]> {
  const next = sanitizeUserLinks(links)
  lsSet(LINKS_KEY, JSON.stringify(next))
  return next
}

/** 剪贴板（Web Clipboard API；ArkWeb 支持 navigator.clipboard） */
export async function harmonyCopyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // 剪贴板失败静默（调用方有 toast 反馈链路）
  }
}

/**
 * 检查更新（原生 fetch 版，逻辑与 androidCheckUpdate 同构）：
 * 鸿蒙端更新 = 打开所选渠道 Release 页手动下载 HAP/APK（壳内自动更新为后续增量）
 */
export async function harmonyCheckUpdate(): Promise<UpdateCheckResult> {
  const current = HARMONY_APP_VERSION
  try {
    const channel = (await harmonyGetConfig()).updateChannel
    if (!isUpdateChannel(channel)) {
      return { current, latest: null, hasUpdate: false, error: '尚未选择更新渠道，请先在设置中选择' }
    }
    const info = UPDATE_CHANNEL_INFO[channel]
    const res = await fetch(info.releaseApi, { headers: info.headers, signal: AbortSignal.timeout(10_000) })
    const status = res.status
    if (status === 403 || status === 401) {
      return { current, latest: null, hasUpdate: false, error: '接口访问受限（限流），请稍后再试' }
    }
    if (status < 200 || status >= 300) {
      return { current, latest: null, hasUpdate: false, error: `HTTP ${status}` }
    }
    const text = await res.text()
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

export function harmonyOnUpdateEvent(cb: (e: UpdateEvent) => void): () => void {
  void cb
  return () => {}
}

export function harmonyOnNavigate(cb: (page: string) => void): () => void {
  void cb
  return () => {}
}

export function harmonyOnDownloadEvent(cb: (e: DownloadEvent) => void): () => void {
  void cb
  return () => {}
}

export function harmonyRestoreData(_target: RestoreTarget): Promise<boolean> {
  void _target
  return Promise.resolve(false)
}
