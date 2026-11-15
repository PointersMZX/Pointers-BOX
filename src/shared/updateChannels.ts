// 更新渠道映射（v2.1.0）：国内镜像 Gitee / 全球官方 GitHub
// v2.6.0：关闭 Gitee 与蓝奏云（单文件附件 100MB 上限，不适用于本多平台更新包）——
// 仅保留 GitHub 全球官方渠道，渠道固定、不再有选择弹窗
import type { UpdateChannel } from './types'

export const UPDATE_CHANNELS: UpdateChannel[] = ['github']

export interface UpdateChannelInfo {
  /** 渠道 API 的 latest release 端点 */
  releaseApi: string
  /** 渠道 Release 页面（跳转/展示用） */
  releasePage: string
  /** 请求 API 时附带的 headers */
  headers: Record<string, string>
}

export const UPDATE_CHANNEL_INFO: Record<UpdateChannel, UpdateChannelInfo> = {
  github: {
    releaseApi: 'https://api.github.com/repos/PointersMZX/Pointers-BOX/releases/latest',
    releasePage: 'https://github.com/PointersMZX/Pointers-BOX/releases',
    headers: { 'User-Agent': 'Pointers-BOX-Updater', Accept: 'application/vnd.github+json' }
  }
}

/** 渠道归一化：仅接受 GitHub（v2.6.0 渠道已固定）；非法值返回 undefined（config 兜底 github） */
export function normalizeUpdateChannel(raw: unknown): UpdateChannel | undefined {
  return raw === 'github' ? 'github' : undefined
}

export function isUpdateChannel(raw: unknown): raw is UpdateChannel {
  return raw === 'github'
}

/** 后台标签闲置休眠分钟数归一化：0 = 永不；非法回退默认 5 分钟 */
export function normalizeTabSleepMinutes(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return 5
  return Math.floor(raw)
}

const HOME_LAYOUTS = ['stacked', 'compact', 'wide'] as const
/** 主页布局归一化（v2.2.0）：非法回退默认 compact（紧凑，每行 2 个） */
export function normalizeHomeLayout(raw: unknown): 'stacked' | 'compact' | 'wide' {
  return HOME_LAYOUTS.includes(raw as 'stacked' | 'compact' | 'wide')
    ? (raw as 'stacked' | 'compact' | 'wide')
    : 'compact'
}

/**
 * Windows 版本分流（v2.1.0）：Win7/8 用户必须更新 Electron 22 兼容版，
 * 否则被推送到 Electron 33 安装包后应用无法启动。
 * - electron-updater channel：win7 → 'win7'（读 latest-win7.yml），win10+ → 默认（读 latest.yml）
 * 返回 null = 非 Windows 平台（Android/iOS 用标准渠道）
 */
export function winCompatFromOsVersion(platform: string, osVersion: string): boolean | null {
  if (platform !== 'win32') return null
  const release = osVersion.toLowerCase()
  // Windows 11 = build >= 22000；Windows 10 = 10240-19045；Windows 7/8 = 7600-9200
  const m = /\b(\d{5})\b/.exec(release)
  if (m) {
    const build = Number(m[1])
    return !(build >= 10240)
  }
  // 兜底：解析 "10.0.xxx" / "6.1.xxx" 格式（主版本 < 10 即 Win7/8）
  const ver = /^\s*(\d+)\./.exec(release)
  if (ver) {
    const major = Number(ver[1])
    return major < 10
  }
  return false
}
