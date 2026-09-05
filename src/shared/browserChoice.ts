// 资源链接打开方式决策（PRD 4.4：Android 打开方式；桌面端固定内置浏览器）
import type { AndroidBrowserChoice } from './types'
import type { AppPlatform } from './platformPages'

export type OpenMode = 'in-app-webview' | 'builtin-browser' | 'system-browser'

export function resolveOpenMode(
  androidBrowser: AndroidBrowserChoice | undefined,
  platform: AppPlatform
): OpenMode {
  if (platform === 'desktop') return 'in-app-webview'
  return androidBrowser === 'system' ? 'system-browser' : 'builtin-browser'
}
