// 主题系统纯逻辑（v2.6.0 深浅双色重做）：
// - light 浅色 / dark 深色：全局液态玻璃恒开，玻璃零染色（纯光学）
// - 旧四主题（zj/custom/black/white）已删除，读取旧配置自动迁移：
//   zj/custom/black/glass → dark，white → light
// - 强调色两主题均可自定义（用于主按钮/进度条/焦点环等指示元素；
//   导航选中态零颜色——磨砂+棱线，不用强调色填充）
export type ThemeKey = 'light' | 'dark'

// 液态玻璃按主题显式开关（v2.3.0 遗留类型；v2.6.0 起玻璃恒开，字段仅为兼容旧配置保留）
export type LiquidGlassMap = Partial<Record<ThemeKey, boolean>>

export const THEME_KEYS: readonly ThemeKey[] = ['light', 'dark']
export const DEFAULT_THEME: ThemeKey = 'dark'
// 默认强调色（电光紫，v2.2.0 起；两主题通用）
export const DEFAULT_ACCENT = '#7c5cff'

// v2.6.0 全局液态玻璃：开关已移除，液态玻璃是应用的唯一外观——所有主题恒开。
// 旧配置里的按主题开关字段仍在读取链路上（normalize/持久化兼容），但不再产生任何效果。
export function defaultLiquidGlass(_theme: ThemeKey): boolean {
  return true
}

// 全主题玻璃恒开（无锁死概念，函数保留兼容调用方）
export function isGlassLocked(_theme: ThemeKey): boolean {
  return true
}

/**
 * 生效的液态玻璃开关：v2.6.0 起恒 true（开关已删除；perTheme 参数仅为兼容旧签名保留）
 */
export function effectiveLiquidGlass(
  _theme: ThemeKey,
  _perTheme?: Partial<Record<ThemeKey, boolean>> | null
): boolean {
  return true
}

// v2.6.0：两主题均可自定义强调色（主按钮/进度条/焦点环；导航选中态零色不消费）
export function canCustomizeAccent(_theme: ThemeKey): boolean {
  return true
}

// 旧四主题键 → 新双主题迁移（zj/custom/black 深色系 → dark；white → light）
function migrateThemeKey(v: string): ThemeKey | null {
  switch (v) {
    case 'zj':
    case 'custom':
    case 'black':
    case 'glass':
      return 'dark'
    case 'white':
      return 'light'
    default:
      return null
  }
}

export function normalizeTheme(v: unknown): ThemeKey {
  if (typeof v === 'string') {
    if ((THEME_KEYS as readonly string[]).includes(v)) return v as ThemeKey
    const migrated = migrateThemeKey(v)
    if (migrated) return migrated
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

// 强调色预设（默认色 #7c5cff 置顶；两主题通用）
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
