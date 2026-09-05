import { create } from 'zustand'
import { DEFAULT_START_URL } from '../../../shared/browser'

// 内置浏览器状态：跨页面"领取"跳转的桥梁
interface BrowserState {
  url: string
  navigateTo: (url: string) => void
}

export const useBrowserStore = create<BrowserState>((set) => ({
  url: DEFAULT_START_URL,
  navigateTo: (url) => set({ url })
}))
