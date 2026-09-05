import { PAGES, isPage, pageFromKeyboard, SHORTCUT_PAGE_MAP } from '../src/shared/routes'

describe('路由表（PRD §2.3）', () => {
  it('页面集合包含 5 个页面', () => {
    expect([...PAGES]).toEqual(['home', 'library', 'browser', 'downloads', 'settings'])
  })

  it('Ctrl+1/2/4/5 映射到 首页/资源库/下载/设置', () => {
    expect(pageFromKeyboard({ ctrlKey: true, code: 'Digit1' })).toBe('home')
    expect(pageFromKeyboard({ ctrlKey: true, code: 'Digit2' })).toBe('library')
    expect(pageFromKeyboard({ ctrlKey: true, code: 'Digit4' })).toBe('downloads')
    expect(pageFromKeyboard({ ctrlKey: true, code: 'Digit5' })).toBe('settings')
    expect(pageFromKeyboard({ ctrlKey: true, code: 'Numpad4' })).toBe('downloads')
  })

  it('浏览器页无快捷键：Ctrl+3 不映射任何页面', () => {
    expect(pageFromKeyboard({ ctrlKey: true, code: 'Digit3' })).toBeNull()
    expect(SHORTCUT_PAGE_MAP['Digit3']).toBeUndefined()
  })

  it('未按 Ctrl 或按了普通键时不切换', () => {
    expect(pageFromKeyboard({ ctrlKey: false, code: 'Digit1' })).toBeNull()
    expect(pageFromKeyboard({ ctrlKey: true, code: 'KeyA' })).toBeNull()
    expect(pageFromKeyboard({ ctrlKey: true, code: undefined })).toBeNull()
    expect(pageFromKeyboard({})).toBeNull()
  })

  it('isPage 类型守卫', () => {
    expect(isPage('home')).toBe(true)
    expect(isPage('nope')).toBe(false)
    expect(isPage(1)).toBe(false)
    expect(isPage(null)).toBe(false)
  })
})
