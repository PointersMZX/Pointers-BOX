import type { AndroidBrowserChoice, AppConfig } from './types'
import { DEFAULT_ACCENT, normalizeAccent, normalizeTheme } from './theme'
import { normalizeHomeLayout, normalizeTabSleepMinutes, normalizeUpdateChannel } from './updateChannels'

// v2.2.0 迁移：存档里等于旧默认的强调色视为“未自定义”，自动跟随新默认
const LEGACY_DEFAULT_ACCENT = '#9f7aea'

// 配置归一化：任何来源（磁盘/部分更新）都收敛为合法 AppConfig
export function normalizeConfig(raw: unknown, defaultDownloadDir: string): AppConfig {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const downloadDirRaw = r['downloadDir']
  const downloadDir =
    typeof downloadDirRaw === 'string' && downloadDirRaw.trim() !== ''
      ? downloadDirRaw
      : defaultDownloadDir
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
  // 更新渠道：undefined = 未选择（首启弹窗）；标签休眠默认 5 分钟（v2.1.0）
  const updateChannel = normalizeUpdateChannel(r['updateChannel'])
  const tabSleepMinutes = normalizeTabSleepMinutes(r['tabSleepMinutes'])
  // 主页布局（v2.2.0）：堆叠/紧凑/宽展，默认紧凑；非法回退 compact
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
  if (updateChannel) cfg.updateChannel = updateChannel
  return cfg
}
