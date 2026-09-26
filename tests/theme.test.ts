import {
  ACCENT_PRESETS,
  accentScale,
  canCustomizeAccent,
  DEFAULT_ACCENT,
  DEFAULT_THEME,
  effectiveLiquidGlass,
  hexToRgb,
  isGlassLocked,
  isValidHex,
  mixColor,
  normalizeAccent,
  normalizeTheme,
  rgbToHex,
  ZJ_ACCENT,
  ZJ_GOLD
} from '../src/shared/theme'

describe('主题键归一化（v2.3.0 四主题，默认紫金黑）', () => {
  it('合法主题键保留，非法回退默认紫金黑', () => {
    expect(normalizeTheme('zj')).toBe('zj')
    expect(normalizeTheme('custom')).toBe('custom')
    expect(normalizeTheme('black')).toBe('black')
    expect(normalizeTheme('white')).toBe('white')
    expect(normalizeTheme('aqua')).toBe(DEFAULT_THEME)
    expect(normalizeTheme(undefined)).toBe(DEFAULT_THEME)
    expect(normalizeTheme(42)).toBe(DEFAULT_THEME)
    expect(DEFAULT_THEME).toBe('zj')
  })

  it('v2.2.0 旧键 glass 迁移为 custom（旧「液态玻璃」主题）', () => {
    expect(normalizeTheme('glass')).toBe('custom')
  })

  it('仅自定义主题可自定义颜色', () => {
    expect(canCustomizeAccent('custom')).toBe(true)
    expect(canCustomizeAccent('zj')).toBe(false)
    expect(canCustomizeAccent('black')).toBe(false)
    expect(canCustomizeAccent('white')).toBe(false)
  })
})

describe('液态玻璃开关（v2.3.0 按主题记忆）', () => {
  it('紫金黑锁死开启：任何配置都开', () => {
    expect(isGlassLocked('zj')).toBe(true)
    expect(effectiveLiquidGlass('zj', {})).toBe(true)
    expect(effectiveLiquidGlass('zj', { zj: false })).toBe(true) // 锁死不可关
    expect(effectiveLiquidGlass('zj', undefined)).toBe(true)
  })

  it('自定义默认开、纯黑/纯白默认关；显式值优先于默认', () => {
    expect(effectiveLiquidGlass('custom', undefined)).toBe(true)
    expect(effectiveLiquidGlass('black', undefined)).toBe(false)
    expect(effectiveLiquidGlass('white', undefined)).toBe(false)
    // 显式覆盖
    expect(effectiveLiquidGlass('custom', { custom: false })).toBe(false)
    expect(effectiveLiquidGlass('black', { black: true })).toBe(true)
    expect(effectiveLiquidGlass('white', { white: true })).toBe(true)
    // 未显式设置的键回各主题默认
    expect(effectiveLiquidGlass('white', { black: true })).toBe(false)
  })

  it('各主题玻璃锁死/默认语义', () => {
    expect(isGlassLocked('custom')).toBe(false)
    expect(isGlassLocked('black')).toBe(false)
    expect(isGlassLocked('white')).toBe(false)
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
    const mid = hexToRgb('#3182ce')!
    const light = hexToRgb(scale['50']!)!
    const dark = hexToRgb(scale['900']!)!
    expect(light.r).toBeGreaterThan(mid.r)
    expect(dark.r).toBeLessThan(mid.r)
  })
})

describe('v2.3.0 常量', () => {
  it('紫金黑固定紫金配色、默认色稳定', () => {
    expect(ZJ_ACCENT).toBe('#7c5cff')
    expect(ZJ_GOLD).toBe('#e8b33e')
    expect(DEFAULT_ACCENT).toBe('#7c5cff')
    expect(ACCENT_PRESETS[0]).toBe('#7c5cff')
  })
})
