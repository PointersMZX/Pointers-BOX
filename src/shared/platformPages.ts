// 平台可见页面（下载管理为桌面专属；v2.3.0 Android 无下载功能、浏览器只走系统浏览器）
import type { Page } from './routes'

export type AppPlatform = 'desktop' | 'android'

export const DESKTOP_PAGES: readonly Page[] = [
  'home',
  'library',
  'links',
  'browser',
  'downloads',
  'settings'
]

// v2.3.0：删除 Android 内嵌浏览器与下载功能——浏览器页只拉起系统浏览器，无下载管理页
export const ANDROID_PAGES: readonly Page[] = [
  'home',
  'library',
  'links',
  'browser',
  'settings'
]

export function visiblePages(platform: AppPlatform): Page[] {
  return [...(platform === 'android' ? ANDROID_PAGES : DESKTOP_PAGES)]
}

export function isPageVisible(page: Page, platform: AppPlatform): boolean {
  return visiblePages(platform).includes(page)
}
