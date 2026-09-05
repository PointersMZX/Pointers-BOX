// 页面路由表（PRD §2.3）：浏览器页无快捷键（无 Ctrl+3）
export const PAGES = ['home', 'library', 'browser', 'downloads', 'settings'] as const

export type Page = (typeof PAGES)[number]

export function isPage(value: unknown): value is Page {
  return typeof value === 'string' && (PAGES as readonly string[]).includes(value)
}

// 键盘快捷键 → 页面（renderer keydown 用；Ctrl+3 按 PRD 不映射）
export const SHORTCUT_PAGE_MAP: Readonly<Record<string, Page>> = {
  Digit1: 'home',
  Numpad1: 'home',
  Digit2: 'library',
  Numpad2: 'library',
  Digit4: 'downloads',
  Numpad4: 'downloads',
  Digit5: 'settings',
  Numpad5: 'settings'
}

export interface KeyboardLike {
  ctrlKey?: boolean
  metaKey?: boolean
  code?: string
}

export function pageFromKeyboard(e: KeyboardLike): Page | null {
  if (!e.ctrlKey && !e.metaKey) return null
  const code = e.code ?? ''
  return SHORTCUT_PAGE_MAP[code] ?? null
}
