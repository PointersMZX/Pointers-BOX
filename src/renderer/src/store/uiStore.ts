import { create } from 'zustand'
import type { Page } from '../../../shared/routes'
import { isPageVisible, type AppPlatform } from '../../../shared/platformPages'

interface UiState {
  page: Page
  platform: AppPlatform
  /** v2.3.2：首页「版本日志·全部」深链——到达设置页时自动展开「版本日志」节 */
  versionLogsDeepLink: boolean
  setPage: (page: Page) => void
  setPlatform: (platform: AppPlatform) => void
  goToVersionLogs: () => void
  consumeVersionLogsDeepLink: () => void
}

export const useUiStore = create<UiState>((set, get) => ({
  page: 'home',
  platform: 'desktop',
  versionLogsDeepLink: false,
  setPage: (page) => {
    if (isPageVisible(page, get().platform)) set({ page })
  },
  setPlatform: (platform) =>
    set((s) => ({
      platform,
      page: isPageVisible(s.page, platform) ? s.page : 'home'
    })),
  // v2.3.2：跳设置页并置深链（平台不可见时静默忽略，与 setPage 同规则）
  goToVersionLogs: () => {
    if (!isPageVisible('settings', get().platform)) return
    set({ versionLogsDeepLink: true, page: 'settings' })
  },
  consumeVersionLogsDeepLink: () => set({ versionLogsDeepLink: false })
}))
