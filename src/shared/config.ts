import type { AndroidBrowserChoice, AppConfig } from './types'
import { DEFAULT_ACCENT, normalizeAccent, normalizeTheme, THEME_KEYS, type ThemeKey } from './theme'
import { normalizeHomeLayout, normalizeTabSleepMinutes, normalizeUpdateChannel } from './updateChannels'

// v2.2.0 迁移：存档里等于旧默认的强调色视为“未自定义”，自动跟随新默认
const LEGACY_DEFAULT_ACCENT = '#9f7aea'

// 液态玻璃按主题开关归一化（v2.3.0）：仅保留合法主题键的布尔值；zj 锁死开启故剔除
export function normalizeLiquidGlass(raw: unknown): Partial<Record<ThemeKey, boolean>> | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const out: Partial<Record<ThemeKey, boolean>> = {}
  for (const k of THEME_KEYS) {
    const v = (raw as Record<string, unknown>)[k]
    if (k !== 'zj' && typeof v === 'boolean') out[k] = v
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
  // v2.3.0：内嵌浏览器已删除，Android 固定系统浏览器；旧 'builtin' 存档无感知迁移
  const androidBrowser: AndroidBrowserChoice = 'system'
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
  // 更新渠道：默认 gitee（国内主渠道，v2.2.0 起首启不再强制弹窗）；显式清空时才 undefined（首启弹窗）
  const updateChannel = r['updateChannel'] === null ? undefined : normalizeUpdateChannel(r['updateChannel']) ?? 'gitee'
  const tabSleepMinutes = normalizeTabSleepMinutes(r['tabSleepMinutes'])
  // 主页布局（v2.2.0）：堆叠/紧凑/宽展，默认紧凑；非法回退 compact
  // 液态玻璃按主题开关（v2.3.0）：缺省 = 各主题用自己的默认值
  const liquidGlass = normalizeLiquidGlass(r['liquidGlass'])
  const cfg: AppConfig = {
    downloadDir,
    androidBrowser,
    theme: normalizeTheme(r['theme']),
    accent,
    favorites,
    keepDownloadHistory,
    tabSleepMinutes,
    homeLayout: normalizeHomeLayout(r['homeLayout'])
  }
  if (liquidGlass) cfg.liquidGlass = liquidGlass
  if (updateChannel) cfg.updateChannel = updateChannel
  return cfg
}
