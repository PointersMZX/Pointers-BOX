import { resolveOpenMode } from '../src/shared/browserChoice'

describe('资源打开方式决策（PRD 4.4 Android 打开方式）', () => {
  it('桌面端固定为内置浏览器页（in-app-webview）', () => {
    expect(resolveOpenMode('builtin', 'desktop')).toBe('in-app-webview')
    expect(resolveOpenMode('system', 'desktop')).toBe('in-app-webview')
    expect(resolveOpenMode(undefined, 'desktop')).toBe('in-app-webview')
  })

  it('Android 端按配置选择内置/系统浏览器', () => {
    expect(resolveOpenMode('builtin', 'android')).toBe('builtin-browser')
    expect(resolveOpenMode('system', 'android')).toBe('system-browser')
  })

  it('Android 端配置缺省回退内置浏览器', () => {
    expect(resolveOpenMode(undefined, 'android')).toBe('builtin-browser')
  })
})
