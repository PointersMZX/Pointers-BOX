import type { AndroidBrowserChoice, AppConfig, LocalUser, UpdateChannel, UpdateType } from './types'
import { DEFAULT_ACCENT, normalizeAccent, normalizeTheme, THEME_KEYS, type ThemeKey } from './theme'
import { normalizeHomeLayout, normalizeTabSleepMinutes, normalizeUpdateChannel } from './updateChannels'

// v2.2.0 迁移：存档里等于旧默认的强调色视为“未自定义”，自动跟随新默认
const LEGACY_DEFAULT_ACCENT = '#9f7aea'

// 本地用户 id 自增生成（不依赖平台全局 crypto，渲染/主进程通用）
let localUserIdSeq = 0
export function generateLocalUserId(): string {
  localUserIdSeq = (localUserIdSeq + 1) % 100000
  return `local_${Date.now().toString(36)}_${localUserIdSeq}`
}

// 液态玻璃按主题开关归一化（v2.3.0）：仅保留合法主题键的布尔值；zj 锁死开启故剔除
export function normalizeLiquidGlass(raw: unknown): Partial<Record<ThemeKey, boolean>> | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const out: Partial<Record<ThemeKey, boolean>> = {}
  for (const k of THEME_KEYS) {
    const v = (raw as Record<string, unknown>)[k]
    if (typeof v === 'boolean') out[k] = v
  }
  return Object.keys(out).length > 0 ? out : undefined
}

// 配置归一化：任何来源（磁盘/部分更新）都收敛为合法 AppConfig
export function normalizeConfig(raw: unknown, defaultDownloadDir: string): AppConfig {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const downloadDirRaw = r['downloadDir']
  const downloadDir =
    typeof downloadDirRaw === 'string' && downloadDirRaw.trim() !== ''
      ? downloadDirRaw
      : defaultDownloadDir
  // v2.5.0：恢复内嵌浏览器——默认内置；仅存档显式 'system' 保留系统浏览器（v2.3.0~v2.4.x
  // 被迫收敛写入的 'system' 也按用户选择尊重，可在设置里切回内置）
  const androidBrowser: AndroidBrowserChoice = r['androidBrowser'] === 'system' ? 'system' : 'builtin'
  // 收藏：接受 string/number 数组，统一字符串化去重（v2.0.0）
  const favorites = Array.isArray(r['favorites'])
    ? [...new Set((r['favorites'] as unknown[]).map((v) => String(v)))]
    : []
  // 下载历史开关：默认关闭（与 PRD 4.3“不记录历史”共存，v2.0.0）
  const keepDownloadHistory = r['keepDownloadHistory'] === true
  // 强调色：等于旧默认 #9f7aea 的存档迁移为新默认（v2.2.0）
  const accentRaw = typeof r['accent'] === 'string' ? r['accent'].trim() : undefined
  const accent =
    accentRaw === undefined || accentRaw === '' || accentRaw.toLowerCase() === LEGACY_DEFAULT_ACCENT
      ? DEFAULT_ACCENT
      : normalizeAccent(accentRaw)
  // 更新渠道（v2.6.0：关闭 Gitee/蓝奏云；保留 GitHub 全球官方 + 网盘手动下载；默认 GitHub）
  const updateChannel = normalizeUpdateChannel(r['updateChannel']) ?? 'github' as UpdateChannel
  const updateType =
    r['updateType'] === 'stable' || r['updateType'] === 'test' ? (r['updateType'] as UpdateType) : 'stable'
  const autoCheckUpdate = r['autoCheckUpdate'] === true
  const tabSleepMinutes = normalizeTabSleepMinutes(r['tabSleepMinutes'])
  // 主页布局（v2.2.0）：堆叠/紧凑/宽展，默认紧凑；非法回退 compact
  // 液态玻璃按主题开关（v2.3.0）：缺省 = 各主题用自己的默认值
  const liquidGlass = normalizeLiquidGlass(r['liquidGlass'])
  // 用户模式（v2.6.0 第 8 条：默认空；本地用户数据全部本地存储，userId 在创建用户时生成）
  const localUser: LocalUser = (() => {
    const lu = (r['localUser'] as LocalUser | undefined) ?? {}
    // 仅有字段才做补全；空对象视为默认（localUser:{}）
    const hasAny = lu && typeof lu === 'object' && !Array.isArray(lu) && Object.keys(lu).length > 0
    if (hasAny) {
      return {
        userId: lu.userId,
        username: lu.username ?? '',
        avatar: lu.avatar ?? '',
        signature: lu.signature ?? '',
        status: lu.status ?? ''
      }
    }
    return {}
  })()
  const cfg: AppConfig = {
    downloadDir,
    androidBrowser,
    theme: normalizeTheme(r['theme']),
    accent,
    favorites,
    keepDownloadHistory,
    tabSleepMinutes,
    homeLayout: normalizeHomeLayout(r['homeLayout']),
    // v2.6.0：更新渠道（GitHub/网盘）；更新类型默认稳定版
    updateChannel,
    updateType,
    autoCheckUpdate,
    localUser,
    // 开发者模式（v2.6.0 第 9 条：默认关闭）
    devMode: r['devMode'] === true,
    // 首启引导（v2.6.0）：字段缺省 = 旧档已用过（视为已完成，不弹引导）；
    // 仅主进程判定为全新安装（config.json 不存在）时写入 false
    onboarded: r['onboarded'] !== false
  }
  if (liquidGlass) cfg.liquidGlass = liquidGlass
  return cfg
}
