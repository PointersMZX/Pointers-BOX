import { create } from 'zustand'
import type { ThemeKey } from '../../../shared/theme'
import {
  canCustomizeAccent,
  normalizeAccent,
  normalizeTheme
} from '../../../shared/theme'
import { backend } from '../platform'

interface ThemeState {
  themeKey: ThemeKey
  accent: string
  /** 初始化：读取后端配置（不回写） */
  applyLocal: (theme: unknown, accent: unknown) => void
  /** 切换主题/颜色：更新本地 + localStorage + 持久化到 config */
  setAppearance: (theme: ThemeKey, accent?: string) => void
}

const LS_KEY = 'pbox-appearance'

function readCached(): { theme?: unknown; accent?: unknown } {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function persistCache(themeKey: ThemeKey, accent: string): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ theme: themeKey, accent }))
  } catch {
    // 缓存失败不影响功能
  }
}

const cached = readCached()

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeKey: normalizeTheme(cached.theme),
  accent: normalizeAccent(cached.accent),

  applyLocal: (theme, accent) => {
    const nextTheme = normalizeTheme(theme)
    const nextAccent = normalizeAccent(accent)
    if (nextTheme !== get().themeKey || nextAccent !== get().accent) {
      set({ themeKey: nextTheme, accent: nextAccent })
      persistCache(nextTheme, nextAccent)
    }
  },

  setAppearance: (theme, accent) => {
    const nextTheme = normalizeTheme(theme)
    // 仅液态玻璃可自定义颜色；其余主题回退默认强调色
    const nextAccent = canCustomizeAccent(nextTheme)
      ? normalizeAccent(accent ?? get().accent)
      : normalizeAccent(undefined)
    set({ themeKey: nextTheme, accent: nextAccent })
    persistCache(nextTheme, nextAccent)
    void backend.setConfig({ theme: nextTheme, accent: nextAccent })
  }
}))
