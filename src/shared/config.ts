import type { AndroidBrowserChoice, AppConfig } from './types'
import { normalizeAccent, normalizeTheme } from './theme'

// 配置归一化：任何来源（磁盘/部分更新）都收敛为合法 AppConfig
export function normalizeConfig(raw: unknown, defaultDownloadDir: string): AppConfig {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const downloadDirRaw = r['downloadDir']
  const downloadDir =
    typeof downloadDirRaw === 'string' && downloadDirRaw.trim() !== ''
      ? downloadDirRaw
      : defaultDownloadDir
  const androidBrowser: AndroidBrowserChoice = r['androidBrowser'] === 'system' ? 'system' : 'builtin'
  return {
    downloadDir,
    androidBrowser,
    theme: normalizeTheme(r['theme']),
    accent: normalizeAccent(r['accent'])
  }
}
