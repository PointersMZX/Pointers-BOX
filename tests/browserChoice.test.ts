import { resolveOpenMode } from '../src/shared/browserChoice'

describe('资源打开方式决策（v2.5.0：Android 恢复内嵌浏览器，按配置分流）', () => {
  it('桌面端固定为内置浏览器页（in-app-webview）', () => {
    expect(resolveOpenMode('system', 'desktop')).toBe('in-app-webview')
    expect(resolveOpenMode(undefined, 'desktop')).toBe('in-app-webview')
  })

  it('Android 端按配置分流：内置 → 原生浏览器；系统 → 系统浏览器', () => {
    expect(resolveOpenMode('builtin', 'android')).toBe('builtin-browser')
    expect(resolveOpenMode('system', 'android')).toBe('system-browser')
    // 未配置（异常存档）回默认内置
    expect(resolveOpenMode(undefined, 'android')).toBe('builtin-browser')
  })
})
