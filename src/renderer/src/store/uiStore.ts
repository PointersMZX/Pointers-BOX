import { create } from 'zustand'
import type { Page } from '../../../shared/routes'
import { isPageVisible, type AppPlatform } from '../../../shared/platformPages'

interface UiState {
  page: Page
  platform: AppPlatform
  setPage: (page: Page) => void
  setPlatform: (platform: AppPlatform) => void
}

export const useUiStore = create<UiState>((set, get) => ({
  page: 'home',
  platform: 'desktop',
  setPage: (page) => {
    if (isPageVisible(page, get().platform)) set({ page })
  },
  setPlatform: (platform) =>
    set((s) => ({
      platform,
      page: isPageVisible(s.page, platform) ? s.page : 'home'
    }))
}))
