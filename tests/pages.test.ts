import { ANDROID_PAGES, DESKTOP_PAGES, isPageVisible, visiblePages } from '../src/shared/platformPages'

describe('平台可见页面（产品决策更新：Android 与桌面同功能集）', () => {
  it('桌面端可见全部 5 页', () => {
    expect(visiblePages('desktop')).toEqual([
      'home',
      'library',
      'browser',
      'downloads',
      'settings'
    ])
    expect(DESKTOP_PAGES).toHaveLength(5)
  })

  it('Android 端同样包含浏览器页与下载管理页（用户要求全功能）', () => {
    expect(visiblePages('android')).toEqual([
      'home',
      'library',
      'browser',
      'downloads',
      'settings'
    ])
    expect(ANDROID_PAGES).toContain('browser')
    expect(ANDROID_PAGES).toContain('downloads')
  })

  it('isPageVisible 逐页判定（两平台一致）', () => {
    for (const page of ['home', 'library', 'browser', 'downloads', 'settings'] as const) {
      expect(isPageVisible(page, 'desktop')).toBe(true)
      expect(isPageVisible(page, 'android')).toBe(true)
    }
  })

  it('visiblePages 返回副本，外部修改不影响内部常量', () => {
    const pages = visiblePages('desktop')
    pages.push('home')
    expect(visiblePages('desktop')).toHaveLength(5)
  })
})
