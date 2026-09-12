import { create } from 'zustand'
import { DEFAULT_START_URL } from '../../../shared/browser'

// 内置浏览器多标签状态机（v2.0.0）：新建/关闭/切换/拖拽排序；标签内会话独立保留
// v2.1.0：后台标签闲置休眠——超时未激活的标签卸载其 webview（释放渲染进程内存），
// 切回时重新挂载加载当前 URL（会话 Cookie 在共享 session 中不丢失）
export interface BrowserTab {
  id: string
  url: string
  title: string
  /** 最近一次成为活动标签的时间戳（休眠判定用） */
  lastActiveAt: number
}

interface BrowserState {
  tabs: BrowserTab[]
  activeId: string
  /** 外部跳转（领取等）：导航到当前活动标签 */
  navigateTo: (url: string) => void
  /** 新建标签（默认起始页）并激活 */
  newTab: (url?: string) => void
  /** 关闭标签；关闭最后一个时自动新建空白标签，保证至少一个 */
  closeTab: (id: string) => void
  setActive: (id: string) => void
  updateTab: (id: string, patch: Partial<Pick<BrowserTab, 'url' | 'title'>>) => void
  /** 拖拽排序：把 from 位置的标签移动到 to 位置 */
  reorderTabs: (from: number, to: number) => void
  /** 会话重置：全部标签回到起始页 */
  resetAllTabs: (url?: string) => void
}

let seq = 0
function makeTab(url: string): BrowserTab {
  seq += 1
  return { id: `tab-${seq}`, url, title: '新标签页', lastActiveAt: Date.now() }
}

const first = makeTab(DEFAULT_START_URL)

export const useBrowserStore = create<BrowserState>((set, get) => ({
  tabs: [first],
  activeId: first.id,

  navigateTo: (url) => {
    const { tabs, activeId } = get()
    set({ tabs: tabs.map((t) => (t.id === activeId ? { ...t, url } : t)) })
  },

  newTab: (url = DEFAULT_START_URL) => {
    const t = makeTab(url)
    set({ tabs: [...get().tabs, t], activeId: t.id })
  },

  closeTab: (id) => {
    const { tabs, activeId } = get()
    const idx = tabs.findIndex((t) => t.id === id)
    if (idx === -1) return
    let next = tabs.filter((t) => t.id !== id)
    let nextActive = activeId
    if (next.length === 0) {
      const fresh = makeTab(DEFAULT_START_URL)
      next = [fresh]
      nextActive = fresh.id
    } else if (activeId === id) {
      const neighbor = next[Math.min(idx, next.length - 1)] ?? next[0]
      nextActive = (neighbor as BrowserTab).id
      // 关闭活动标签后邻居成为活动标签，刷新其时间戳
      set({ tabs: next.map((t) => (t.id === nextActive ? { ...t, lastActiveAt: Date.now() } : t)) })
      next = get().tabs
    }
    set({ tabs: next, activeId: nextActive })
  },

  setActive: (id) => {
    const { tabs, activeId } = get()
    if (id === activeId) return
    const next = tabs.map((t) => (t.id === id ? { ...t, lastActiveAt: Date.now() } : t))
    set({ tabs: next, activeId: id })
  },

  updateTab: (id, patch) =>
    set({ tabs: get().tabs.map((t) => (t.id === id ? { ...t, ...patch } : t)) }),

  reorderTabs: (from, to) => {
    const tabs = [...get().tabs]
    if (from === to || from < 0 || to < 0 || from >= tabs.length || to >= tabs.length) return
    const moved = tabs.splice(from, 1)[0]
    if (moved) tabs.splice(to, 0, moved)
    set({ tabs })
  },

  resetAllTabs: (url = DEFAULT_START_URL) => {
    set({ tabs: get().tabs.map((t) => ({ ...t, url, title: '新标签页', lastActiveAt: Date.now() })) })
  }
}))

/**
 * 休眠判定（v2.1.0 纯函数）：哪些后台标签应被休眠。
 * - activeId 对应标签永不休眠
 * - sleepMinutes = 0 表示永不休眠
 * - 闲置超过 sleepMinutes 分钟的后台标签进入休眠（返回 true）
 */
export function shouldSleepTab(
  tab: { id: string; lastActiveAt: number },
  activeId: string,
  sleepMinutes: number,
  now = Date.now()
): boolean {
  if (sleepMinutes <= 0) return false
  if (tab.id === activeId) return false
  return now - tab.lastActiveAt >= sleepMinutes * 60_000
}

/** 当前活动标签（tabs 异常时兜底第一个） */
export function getActiveTab(s: { tabs: BrowserTab[]; activeId: string }): BrowserTab {
  return s.tabs.find((t) => t.id === s.activeId) ?? (s.tabs[0] as BrowserTab)
}
