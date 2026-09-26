// 资源链接打开方式决策（v2.3.0：Android 内嵌浏览器已删除，固定走系统浏览器；桌面端固定内置浏览器）
import type { AndroidBrowserChoice } from './types'
import type { AppPlatform } from './platformPages'

export type OpenMode = 'in-app-webview' | 'system-browser'

/**
 * v2.3.0：Android 端不再区分内置/系统——统一自动跳转系统浏览器。
 * androidBrowser 参数保留仅为配置迁移锚点（旧 'builtin' 存档无感知收敛）。
 */
export function resolveOpenMode(
  androidBrowser: AndroidBrowserChoice | undefined,
  platform: AppPlatform
): OpenMode {
  void androidBrowser
  if (platform === 'desktop') return 'in-app-webview'
  return 'system-browser'
}
