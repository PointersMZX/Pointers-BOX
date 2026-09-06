// 平台可见页面（PRD 4.3 下载管理为桌面专属；Android 打开方式决定浏览器页形态）
import type { Page } from './routes'

export type AppPlatform = 'desktop' | 'android'

export const DESKTOP_PAGES: readonly Page[] = [
  'home',
  'library',
  'browser',
  'downloads',
  'settings'
]

// Android 与桌面同功能集：内置浏览器走原生 InAppBrowserActivity，下载由系统 DownloadManager 接管
export const ANDROID_PAGES: readonly Page[] = [
  'home',
  'library',
  'browser',
  'downloads',
  'settings'
]

export function visiblePages(platform: AppPlatform): Page[] {
  return [...(platform === 'android' ? ANDROID_PAGES : DESKTOP_PAGES)]
}

export function isPageVisible(page: Page, platform: AppPlatform): boolean {
  return visiblePages(platform).includes(page)
}
