import { DESKTOP_PAGES, ANDROID_PAGES, isPageVisible, visiblePages } from '../src/shared/platformPages'

describe('平台可见页面（PRD 4.3 + 计划 D6）', () => {
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

  it('Android 端隐藏浏览器页与下载管理页', () => {
    expect(visiblePages('android')).toEqual(['home', 'library', 'settings'])
    expect(ANDROID_PAGES).not.toContain('downloads')
    expect(ANDROID_PAGES).not.toContain('browser')
  })

  it('isPageVisible 逐页判定', () => {
    expect(isPageVisible('downloads', 'desktop')).toBe(true)
    expect(isPageVisible('downloads', 'android')).toBe(false)
    expect(isPageVisible('settings', 'android')).toBe(true)
  })

  it('visiblePages 返回副本，外部修改不影响内部常量', () => {
    const pages = visiblePages('desktop')
    pages.push('home')
    expect(visiblePages('desktop')).toHaveLength(5)
  })
})
