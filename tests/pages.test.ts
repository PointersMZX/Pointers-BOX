import { ANDROID_PAGES, DESKTOP_PAGES, isPageVisible, visiblePages } from '../src/shared/platformPages'

describe('平台可见页面（v2.5.0：Android 恢复内嵌浏览器与下载管理，6 页对齐桌面）', () => {
  it('桌面端可见全部 6 页', () => {
    expect(visiblePages('desktop')).toEqual([
      'home',
      'library',
      'links',
      'browser',
      'downloads',
      'settings'
    ])
    expect(DESKTOP_PAGES).toHaveLength(6)
  })

  it('Android 端 6 页：含浏览器页（内置/系统双模式）与下载管理页', () => {
    expect(visiblePages('android')).toEqual([
      'home',
      'library',
      'links',
      'browser',
      'downloads',
      'settings'
    ])
    expect(ANDROID_PAGES).toContain('browser')
    expect(ANDROID_PAGES).toContain('downloads')
    expect(ANDROID_PAGES).toHaveLength(6)
  })

  it('isPageVisible 逐页判定（两端全可见）', () => {
    for (const page of ['home', 'library', 'links', 'browser', 'downloads', 'settings'] as const) {
      expect(isPageVisible(page, 'desktop')).toBe(true)
      expect(isPageVisible(page, 'android')).toBe(true)
    }
  })

  it('visiblePages 返回副本，外部修改不影响内部常量', () => {
    const pages = visiblePages('desktop')
    pages.push('home')
    expect(visiblePages('desktop')).toHaveLength(6)
  })
})
