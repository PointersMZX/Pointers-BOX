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

// Android：领取走内置/系统浏览器拉起，无独立浏览器页；下载管理为 Electron 专属
export const ANDROID_PAGES: readonly Page[] = ['home', 'library', 'settings']

export function visiblePages(platform: AppPlatform): Page[] {
  return [...(platform === 'android' ? ANDROID_PAGES : DESKTOP_PAGES)]
}

export function isPageVisible(page: Page, platform: AppPlatform): boolean {
  return visiblePages(platform).includes(page)
}
