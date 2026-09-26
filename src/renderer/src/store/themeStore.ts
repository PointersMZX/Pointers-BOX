import { create } from 'zustand'
import type { ThemeKey } from '../../../shared/theme'
import {
  canCustomizeAccent,
  effectiveLiquidGlass,
  normalizeAccent,
  normalizeTheme,
  type LiquidGlassMap
} from '../../../shared/theme'
import { backend } from '../platform'

interface ThemeState {
  themeKey: ThemeKey
  accent: string
  /** 液态玻璃按主题显式开关（v2.3.0）：缺省键 = 用该主题默认；zj 锁死开启被忽略 */
  liquidGlass: LiquidGlassMap
  /** 当前生效的玻璃开关（锁死主题恒 true；其余 = 显式值 ?? 主题默认） */
  isGlassOn: boolean
  /** 初始化：读取后端配置（不回写） */
  applyLocal: (theme: unknown, accent: unknown, liquidGlass: unknown) => void
  /** 切换主题/颜色/玻璃：更新本地 + localStorage + 持久化到 config */
  setAppearance: (theme: ThemeKey, accent?: string, liquidGlass?: boolean) => void
}

const LS_KEY = 'pbox-appearance'

// 液态玻璃按主题开关归一化（本地缓存用；与 normalizeLiquidGlass 同规则）
function normalizeGlassMap(v: unknown): LiquidGlassMap {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return {}
  const out: LiquidGlassMap = {}
  for (const k of ['custom', 'black', 'white'] as const) {
    const val = (v as Record<string, unknown>)[k]
    if (typeof val === 'boolean') out[k] = val
  }
  return out
}

function readCached(): { theme?: unknown; accent?: unknown; liquidGlass?: unknown } {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function persistCache(themeKey: ThemeKey, accent: string, liquidGlass: LiquidGlassMap): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ theme: themeKey, accent, liquidGlass }))
  } catch {
    // 缓存失败不影响功能
  }
}

const cached = readCached()
const cachedTheme = normalizeTheme(cached.theme)
const cachedGlass = normalizeGlassMap(cached.liquidGlass)

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeKey: cachedTheme,
  accent: normalizeAccent(cached.accent),
  liquidGlass: cachedGlass,
  isGlassOn: effectiveLiquidGlass(cachedTheme, cachedGlass),

  applyLocal: (theme, accent, liquidGlass) => {
    const nextTheme = normalizeTheme(theme)
    const nextAccent = normalizeAccent(accent)
    const nextGlass = normalizeGlassMap(liquidGlass)
    if (
      nextTheme !== get().themeKey ||
      nextAccent !== get().accent ||
      JSON.stringify(nextGlass) !== JSON.stringify(get().liquidGlass)
    ) {
      set({
        themeKey: nextTheme,
        accent: nextAccent,
        liquidGlass: nextGlass,
        isGlassOn: effectiveLiquidGlass(nextTheme, nextGlass)
      })
      persistCache(nextTheme, nextAccent, nextGlass)
    }
  },

  setAppearance: (theme, accent, liquidGlass) => {
    const nextTheme = normalizeTheme(theme)
    // 仅自定义主题可自定义颜色；其余主题回退默认强调色
    const nextAccent = canCustomizeAccent(nextTheme)
      ? normalizeAccent(accent ?? get().accent)
      : normalizeAccent(undefined)
    // 玻璃开关：显式传值则写该主题键；不传则保留既有按主题值（生效值随主题默认变化）
    const nextGlass: LiquidGlassMap = { ...get().liquidGlass }
    if (liquidGlass !== undefined) nextGlass[nextTheme] = liquidGlass
    set({
      themeKey: nextTheme,
      accent: nextAccent,
      liquidGlass: nextGlass,
      isGlassOn: effectiveLiquidGlass(nextTheme, nextGlass)
    })
    persistCache(nextTheme, nextAccent, nextGlass)
    void backend.setConfig({ theme: nextTheme, accent: nextAccent, liquidGlass: nextGlass })
  }
}))
