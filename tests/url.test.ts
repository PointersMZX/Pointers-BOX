import { DEFAULT_START_URL, isHttpUrl, normalizeAddressInput, RESET_STORAGES } from '../src/shared/browser'

describe('地址栏归一化（PRD 4.2 支持手动输入）', () => {
  it('空输入回到起始页', () => {
    expect(normalizeAddressInput('')).toBe(DEFAULT_START_URL)
    expect(normalizeAddressInput('   ')).toBe(DEFAULT_START_URL)
  })

  it('已带协议的地址原样保留', () => {
    expect(normalizeAddressInput('https://example.com/a?b=1')).toBe('https://example.com/a?b=1')
    expect(normalizeAddressInput('http://example.com')).toBe('http://example.com')
  })

  it('localhost 与 IP 使用 http 协议', () => {
    expect(normalizeAddressInput('localhost:3000')).toBe('http://localhost:3000')
    expect(normalizeAddressInput('192.168.1.1/box')).toBe('http://192.168.1.1/box')
  })

  it('疑似域名补 https', () => {
    expect(normalizeAddressInput('pointers-box.cc.cd')).toBe('https://pointers-box.cc.cd')
    expect(normalizeAddressInput('example.com/path')).toBe('https://example.com/path')
  })

  it('普通文本转为搜索', () => {
    expect(normalizeAddressInput('资源 下载')).toBe(
      `https://www.bing.com/search?q=${encodeURIComponent('资源 下载')}`
    )
  })
})

describe('导航白名单（webview 安全）', () => {
  it('放行 http/https', () => {
    expect(isHttpUrl('https://a.com')).toBe(true)
    expect(isHttpUrl('HTTP://A.COM')).toBe(true)
  })

  it('拒绝 file:// 与自定义协议', () => {
    expect(isHttpUrl('file:///C:/Windows/system32')).toBe(false)
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isHttpUrl('chrome://settings')).toBe(false)
  })
})

describe('会话重置存储清单（PRD 4.2/7.3）', () => {
  it('包含 Cookie 与主要登录态存储', () => {
    expect(RESET_STORAGES).toContain('cookies')
    expect(RESET_STORAGES).toContain('localstorage')
    expect(RESET_STORAGES).toContain('indexdb')
    expect(RESET_STORAGES).toContain('serviceworkers')
    expect(RESET_STORAGES.length).toBeGreaterThanOrEqual(6)
  })

  it('起始页指向平台站点', () => {
    expect(DEFAULT_START_URL).toMatch(/^https:\/\/pointers-box\.cc\.cd/)
  })
})
