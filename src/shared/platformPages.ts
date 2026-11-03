// 平台可见页面（v2.5.0：Android 恢复内嵌浏览器与下载管理，6 页对齐桌面）
import type { Page } from './routes'

export type AppPlatform = 'desktop' | 'android' | 'harmony'

export const DESKTOP_PAGES: readonly Page[] = [
  'home',
  'library',
  'links',
  'browser',
  'downloads',
  'settings'
]

export const ANDROID_PAGES: readonly Page[] = [
  'home',
  'library',
  'links',
  'browser',
  'downloads',
  'settings'
]

export function visiblePages(platform: AppPlatform): Page[] {
  // v2.6.0：鸿蒙壳与 Android 同构（移动布局 6 页）
  return [...(platform === 'desktop' ? DESKTOP_PAGES : ANDROID_PAGES)]
}

export function isPageVisible(page: Page, platform: AppPlatform): boolean {
  return visiblePages(platform).includes(page)
}
