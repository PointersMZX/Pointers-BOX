import { resolveOpenMode } from '../src/shared/browserChoice'

describe('资源打开方式决策（v2.3.0：Android 内嵌浏览器删除，固定系统浏览器）', () => {
  it('桌面端固定为内置浏览器页（in-app-webview）', () => {
    expect(resolveOpenMode('system', 'desktop')).toBe('in-app-webview')
    expect(resolveOpenMode(undefined, 'desktop')).toBe('in-app-webview')
  })

  it('Android 端一律系统浏览器（忽略旧内置/系统配置）', () => {
    expect(resolveOpenMode('system', 'android')).toBe('system-browser')
    expect(resolveOpenMode(undefined, 'android')).toBe('system-browser')
  })
})
