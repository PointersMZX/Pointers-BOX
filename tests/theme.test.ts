import {
  accentScale,
  canCustomizeAccent,
  DEFAULT_ACCENT,
  DEFAULT_THEME,
  hexToRgb,
  isValidHex,
  mixColor,
  normalizeAccent,
  normalizeTheme,
  rgbToHex
} from '../src/shared/theme'

describe('主题键归一化（默认液态玻璃）', () => {
  it('合法主题键保留，非法回退默认液态玻璃', () => {
    expect(normalizeTheme('glass')).toBe('glass')
    expect(normalizeTheme('black')).toBe('black')
    expect(normalizeTheme('white')).toBe('white')
    expect(normalizeTheme('aqua')).toBe(DEFAULT_THEME)
    expect(normalizeTheme(undefined)).toBe(DEFAULT_THEME)
    expect(normalizeTheme(42)).toBe(DEFAULT_THEME)
    expect(DEFAULT_THEME).toBe('glass')
  })

  it('仅液态玻璃主题可自定义颜色', () => {
    expect(canCustomizeAccent('glass')).toBe(true)
    expect(canCustomizeAccent('black')).toBe(false)
    expect(canCustomizeAccent('white')).toBe(false)
  })
})

describe('强调色归一化', () => {
  it('#rgb 扩展为 #rrggbb，统一小写', () => {
    expect(normalizeAccent('#F0a')).toBe('#ff00aa')
    expect(normalizeAccent('#3182CE')).toBe('#3182ce')
  })

  it('#rrggbbaa 丢弃 alpha', () => {
    expect(normalizeAccent('#3182ceff')).toBe('#3182ce')
  })

  it('非法输入回退默认色', () => {
    expect(normalizeAccent('red')).toBe(DEFAULT_ACCENT)
    expect(normalizeAccent('#12')).toBe(DEFAULT_ACCENT)
    expect(normalizeAccent(null)).toBe(DEFAULT_ACCENT)
    expect(normalizeAccent(123)).toBe(DEFAULT_ACCENT)
  })
})

describe('颜色工具', () => {
  it('hex ↔ rgb 往返', () => {
    expect(hexToRgb('#3182ce')).toEqual({ r: 49, g: 130, b: 206 })
    expect(rgbToHex(49, 130, 206)).toBe('#3182ce')
    expect(hexToRgb('nope')).toBeNull()
  })

  it('isValidHex 校验 3/6 位十六进制', () => {
    expect(isValidHex('#abc')).toBe(true)
    expect(isValidHex('#aabbcc')).toBe(true)
    expect(isValidHex('#aabbc')).toBe(false)
    expect(isValidHex('blue')).toBe(false)
  })

  it('mixColor 端点与中点', () => {
    expect(mixColor('#000000', '#ffffff', 0)).toBe('#000000')
    expect(mixColor('#000000', '#ffffff', 1)).toBe('#ffffff')
    expect(mixColor('#000000', '#ffffff', 0.5)).toBe('#808080')
  })

  it('accentScale 生成 50-900 十一档色阶且两端方向正确', () => {
    const scale = accentScale('#3182ce')
    expect(Object.keys(scale).sort()).toEqual(
      ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'].sort()
    )
    expect(scale['500']).toBe('#3182ce')
    expect(scale['50']).not.toBe(scale['900'])
    // 50 比主色更接近白色，900 更接近黑色
    const mid = hexToRgb('#3182ce')!
    const light = hexToRgb(scale['50']!)!
    const dark = hexToRgb(scale['900']!)!
    expect(light.r).toBeGreaterThan(mid.r)
    expect(dark.r).toBeLessThan(mid.r)
  })
})
