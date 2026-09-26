// 主题系统纯逻辑（v2.3.0 四主题重做）：
// - zj 紫金黑：玻璃锁死开启、固定紫金配色（不可自定义颜色）
// - custom 自定义：自选强调色 + 液态玻璃可关（默认开）
// - black 纯黑 / white 纯白：液态玻璃默认关（可开）
// 液态玻璃开关按主题记忆：配置存 Partial<Record<ThemeKey, boolean>>，缺省用主题默认。
export type ThemeKey = 'zj' | 'custom' | 'black' | 'white'

// 液态玻璃按主题显式开关（缺省键 = 未设置过，走主题默认）
export type LiquidGlassMap = Partial<Record<ThemeKey, boolean>>

export const THEME_KEYS: readonly ThemeKey[] = ['zj', 'custom', 'black', 'white']
// v2.3.0：默认主题紫金黑（新品牌图标同款紫金视觉）
export const DEFAULT_THEME: ThemeKey = 'zj'
// 自定义主题默认强调色（电光紫，v2.2.0 起）
export const DEFAULT_ACCENT = '#7c5cff'
// 紫金黑固定配色：紫（主强调）+ 金（次色/玻璃边缘流光）
export const ZJ_ACCENT = '#7c5cff'
export const ZJ_GOLD = '#e8b33e'

// 各主题液态玻璃默认值：紫金黑/自定义 开，纯黑/纯白 关
export function defaultLiquidGlass(theme: ThemeKey): boolean {
  return theme === 'zj' || theme === 'custom'
}

// 玻璃锁死开启的主题（不提供开关）
export function isGlassLocked(theme: ThemeKey): boolean {
  return theme === 'zj'
}

/**
 * 生效的液态玻璃开关：锁死主题恒开；其余取该主题显式配置，缺省回主题默认。
 * perTheme = 配置里存的按主题开关（缺省键 = 未显式设置过）
 */
export function effectiveLiquidGlass(
  theme: ThemeKey,
  perTheme: Partial<Record<ThemeKey, boolean>> | null | undefined
): boolean {
  if (isGlassLocked(theme)) return true
  const explicit = perTheme?.[theme]
  return explicit !== undefined ? explicit : defaultLiquidGlass(theme)
}

// 仅自定义主题允许自定义颜色（v2.3.0：原“液态玻璃”主题更名为“自定义”）
export function canCustomizeAccent(theme: ThemeKey): boolean {
  return theme === 'custom'
}

export function normalizeTheme(v: unknown): ThemeKey {
  // v2.2.0 旧键迁移：glass → custom（旧“液态玻璃”主题）
  if (v === 'glass') return 'custom'
  if (typeof v === 'string' && (THEME_KEYS as readonly string[]).includes(v)) {
    return v as ThemeKey
  }
  return DEFAULT_THEME
}

// 接受 #rgb / #rrggbb / #rrggbbaa（忽略 alpha），统一为小写 #rrggbb
export function normalizeAccent(v: unknown): string {
  if (typeof v !== 'string') return DEFAULT_ACCENT
  const t = v.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(t)) return t.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(t)) {
    return `#${t
      .slice(1)
      .split('')
      .map((c) => c + c)
      .join('')}`.toLowerCase()
  }
  if (/^#[0-9a-fA-F]{8}$/.test(t)) return t.slice(0, 7).toLowerCase()
  return DEFAULT_ACCENT
}

export interface Rgb {
  r: number
  g: number
  b: number
}

export function hexToRgb(hex: string): Rgb | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex)
  if (!m) return null
  const int = parseInt(m[1] as string, 16)
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 }
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number): string =>
    Math.min(255, Math.max(0, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

export function isValidHex(v: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(v.trim()) || /^#[0-9a-fA-F]{3}$/.test(v.trim())
}

// a 向 b 混合 w∈[0,1]
export function mixColor(a: string, b: string, w: number): string {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  if (!ca || !cb) return a
  const k = Math.min(1, Math.max(0, w))
  return rgbToHex(
    ca.r + (cb.r - ca.r) * k,
    ca.g + (cb.g - ca.g) * k,
    ca.b + (cb.b - ca.b) * k
  )
}

// 由强调色生成 Chakra brand 色阶（50 最浅 → 900 最深）
export function accentScale(accent: string): Record<string, string> {
  return {
    50: mixColor(accent, '#ffffff', 0.9),
    100: mixColor(accent, '#ffffff', 0.78),
    200: mixColor(accent, '#ffffff', 0.62),
    300: mixColor(accent, '#ffffff', 0.45),
    400: mixColor(accent, '#ffffff', 0.22),
    500: accent,
    600: mixColor(accent, '#000000', 0.14),
    700: mixColor(accent, '#000000', 0.32),
    800: mixColor(accent, '#000000', 0.48),
    900: mixColor(accent, '#000000', 0.64)
  }
}

// 自定义主题的预设可选颜色（默认色 #7c5cff 置顶）
export const ACCENT_PRESETS: readonly string[] = [
  '#7c5cff',
  '#e659a8',
  '#c084fc',
  '#3182ce',
  '#00b3a4',
  '#f59e0b',
  '#64748b',
  '#94a3b8'
]
