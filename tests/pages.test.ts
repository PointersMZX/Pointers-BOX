import { ANDROID_PAGES, DESKTOP_PAGES, isPageVisible, visiblePages } from '../src/shared/platformPages'

describe('平台可见页面（v2.3.0：Android 删内嵌浏览器与下载功能）', () => {
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

  it('Android 端 5 页：含浏览器页（系统浏览器），无下载管理页', () => {
    expect(visiblePages('android')).toEqual([
      'home',
      'library',
      'links',
      'browser',
      'settings'
    ])
    expect(ANDROID_PAGES).toContain('browser')
    expect(ANDROID_PAGES).not.toContain('downloads')
    expect(ANDROID_PAGES).toHaveLength(5)
  })

  it('isPageVisible 逐页判定（桌面全可见；Android 无下载）', () => {
    for (const page of ['home', 'library', 'links', 'browser', 'downloads', 'settings'] as const) {
      expect(isPageVisible(page, 'desktop')).toBe(true)
      expect(isPageVisible(page, 'android')).toBe(page !== 'downloads')
    }
  })

  it('visiblePages 返回副本，外部修改不影响内部常量', () => {
    const pages = visiblePages('desktop')
    pages.push('home')
    expect(visiblePages('desktop')).toHaveLength(6)
  })
})
