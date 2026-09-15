// 更新渠道映射（v2.1.0）：国内镜像 Gitee / 全球官方 GitHub
import type { UpdateChannel } from './types'

export const UPDATE_CHANNELS: UpdateChannel[] = ['gitee', 'github']

export interface UpdateChannelInfo {
  /** 渠道 API 的 latest release 端点 */
  releaseApi: string
  /** 渠道 Release 页面（跳转/展示用） */
  releasePage: string
  /** 请求 API 时附带的 headers */
  headers: Record<string, string>
}

export const UPDATE_CHANNEL_INFO: Record<UpdateChannel, UpdateChannelInfo> = {
  gitee: {
    releaseApi: 'https://gitee.com/api/v5/repos/PointersMZX/Pointers-BOX/releases/latest',
    releasePage: 'https://gitee.com/PointersMZX/Pointers-BOX/releases',
    headers: { 'User-Agent': 'Pointers-BOX-Updater' }
  },
  github: {
    releaseApi: 'https://api.github.com/repos/PointersMZX/Pointers-BOX/releases/latest',
    releasePage: 'https://github.com/PointersMZX/Pointers-BOX/releases',
    headers: { 'User-Agent': 'Pointers-BOX-Updater', Accept: 'application/vnd.github+json' }
  }
}

/** 渠道归一化：非法值返回 undefined（v2.2.0 起由 normalizeConfig 兜底默认 gitee） */
export function normalizeUpdateChannel(raw: unknown): UpdateChannel | undefined {
  return raw === 'gitee' || raw === 'github' ? raw : undefined
}

export function isUpdateChannel(raw: unknown): raw is UpdateChannel {
  return raw === 'gitee' || raw === 'github'
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
 * - Gitee 资产名匹配：win7 → 含 "win7"/"windows7"，win10+ → 不含这些词
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

/** 按平台匹配 Release 资产名（Gitee 渠道下载用；win7 = true 匹配 Win7 兼容包） */
export function matchAssetByName(
  assets: Array<{ name: string; url: string; size?: number }>,
  win7: boolean
): { name: string; url: string; size?: number } | undefined {
  const isExe = (name: string): boolean => /\.exe$/i.test(name)
  const isWin7Name = (name: string): boolean => /win7|windows7/i.test(name)
  const exes = assets.filter((a) => isExe(a.name))
  if (exes.length === 0) return undefined
  const target = win7 ? exes.find((a) => isWin7Name(a.name)) : exes.find((a) => !isWin7Name(a.name))
  return target ?? (win7 ? undefined : exes[0])
}
