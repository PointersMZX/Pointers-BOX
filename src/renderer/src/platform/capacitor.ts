// Android 平台实现（计划 D6）：Capacitor 插件承载原生能力
import { Capacitor, CapacitorHttp } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { Preferences } from '@capacitor/preferences'
import { REMOTE_URLS } from '../../../shared/types'
import type {
  AppConfig,
  DataSnapshot,
  DownloadEvent,
  RestoreTarget,
  UpdateCheckResult,
  UpdateEvent
} from '../../../shared/types'
import {
  parseLooseJson,
  validateAnnouncement,
  validateAuthorWords,
  validateBoxInfo,
  validateResources,
  validateVersionLogs
} from '../../../shared/validate'
import { normalizeConfig } from '../../../shared/config'
import { resolveOpenMode } from '../../../shared/browserChoice'

const CONFIG_KEY = 'app-config'
const CACHE_KEY = 'data-cache'
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
  box: unknown
  words: unknown
}): DataSnapshot {
  const clean = validateResources(raw.resources)
  const box = validateBoxInfo(raw.box)
  const authorWords = validateAuthorWords(raw.words)
  return {
    data: {
      resources: clean.valid,
      version_logs: validateVersionLogs(raw.resources),
      announcement: validateAnnouncement(raw.resources)
    },
    box,
    authorWords,
    offline: false,
    lastSync: Date.now(),
    warnings: clean.errors
  }
}

export async function androidGetData(force = false): Promise<DataSnapshot> {
  const results = await Promise.allSettled([
    force ? fetchLooseJson(REMOTE_URLS.resources) : fetchLooseJson(REMOTE_URLS.resources),
    fetchLooseJson(REMOTE_URLS.box),
    fetchLooseJson(REMOTE_URLS.boxzzyhs)
  ])
  const resources = results[0]
  const box = results[1]
  const words = results[2]

  if (resources && resources.status === 'fulfilled') {
    const snapshot = buildSnapshot({
      resources: resources.value,
      box: box && box.status === 'fulfilled' ? box.value : null,
      words: words && words.status === 'fulfilled' ? words.value : null
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
    authorWords: null,
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

export async function androidOpenClaim(url: string, choice?: 'builtin' | 'system'): Promise<void> {
  const mode = resolveOpenMode(choice, 'android')
  if (mode === 'system-browser') {
    // Capacitor WebView 将 target=_blank 路由到系统浏览器（@capacitor/app v6 已移除 openUrl）
    window.open(url, '_blank')
    return
  }
  await Browser.open({ url })
}

export async function androidResetSession(): Promise<void> {
  // Capacitor 内置浏览器每次打开均为全新会话，关闭即重置
  await Browser.close()
}

export function androidOnDownloadEvent(cb: (e: DownloadEvent) => void): () => void {
  // 下载管理为桌面专属；Android 端无下载事件流
  void cb
  return () => {}
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

export function androidCheckUpdate(): Promise<UpdateCheckResult> {
  return Promise.resolve({
    current: '2.0.0',
    latest: null,
    hasUpdate: false,
    error: 'Android 端请从发布渠道获取新版本'
  })
}

export function isAndroidNative(): boolean {
  return Capacitor.isNativePlatform()
}
