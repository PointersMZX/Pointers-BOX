// 资源链接打开方式决策（v2.5.0：Android 恢复内嵌浏览器，按设置分流；桌面端固定内置浏览器）
import type { AndroidBrowserChoice } from './types'
import type { AppPlatform } from './platformPages'

export type OpenMode = 'in-app-webview' | 'builtin-browser' | 'system-browser'

/**
 * Android：配置选内置 → 'builtin-browser'（原生 InAppBrowserActivity）；
 * 选系统 → 'system-browser'。桌面恒 'in-app-webview'（Electron 多标签浏览器）。
 */
export function resolveOpenMode(
  androidBrowser: AndroidBrowserChoice | undefined,
  platform: AppPlatform
): OpenMode {
  if (platform === 'desktop') return 'in-app-webview'
  return androidBrowser === 'system' ? 'system-browser' : 'builtin-browser'
}
