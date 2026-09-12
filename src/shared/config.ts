import type { AndroidBrowserChoice, AppConfig } from './types'
import { normalizeAccent, normalizeTheme } from './theme'
import { normalizeTabSleepMinutes, normalizeUpdateChannel } from './updateChannels'

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
  // 更新渠道：undefined = 未选择（首启弹窗）；标签休眠默认 5 分钟（v2.1.0）
  const updateChannel = normalizeUpdateChannel(r['updateChannel'])
  const tabSleepMinutes = normalizeTabSleepMinutes(r['tabSleepMinutes'])
  const cfg: AppConfig = {
    downloadDir,
    androidBrowser,
    theme: normalizeTheme(r['theme']),
    accent: normalizeAccent(r['accent']),
    favorites,
    keepDownloadHistory,
    tabSleepMinutes
  }
  if (updateChannel) cfg.updateChannel = updateChannel
  return cfg
}
