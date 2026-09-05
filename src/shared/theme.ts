// 主题系统纯逻辑（设置-主题）：主题键/强调色归一化、色阶生成（不含任何功能逻辑）
export type ThemeKey = 'glass' | 'black' | 'white'

export const THEME_KEYS: readonly ThemeKey[] = ['glass', 'black', 'white']
export const DEFAULT_THEME: ThemeKey = 'glass'
export const DEFAULT_ACCENT = '#3182ce'

// 仅液态玻璃主题允许自定义颜色（PRD 4.4 扩展需求）
export function canCustomizeAccent(theme: ThemeKey): boolean {
  return theme === 'glass'
}

export function normalizeTheme(v: unknown): ThemeKey {
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

// 液态玻璃主题的预设可选颜色
export const ACCENT_PRESETS: readonly string[] = [
  '#3182ce',
  '#00b3a4',
  '#7c5cff',
  '#e659a8',
  '#f59e0b',
  '#ef4444',
  '#22c55e',
  '#64748b'
]
