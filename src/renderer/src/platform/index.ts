// 平台后端统一入口（计划 D6 / IPC 契约 §5）：桌面转发 window.api，Android 走 Capacitor
import { Capacitor } from '@capacitor/core'
import type { PBoxApi } from '../../../shared/types'
import { isPage, type Page } from '../../../shared/routes'
import type { AppPlatform } from '../../../shared/platformPages'
import { useBrowserStore } from '../store/browserStore'
import { useUiStore } from '../store/uiStore'
import {
  androidCheckUpdate,
  androidGetData,
  androidGetConfig,
  androidOnDownloadEvent,
  androidOnNavigate,
  androidOnUpdateEvent,
  androidOpenClaim,
  androidResetSession,
  androidRestoreData,
  androidSetConfig
} from './capacitor'

export function currentPlatform(): AppPlatform {
  if (typeof window !== 'undefined' && window.api) return 'desktop'
  return Capacitor.isNativePlatform() ? 'android' : 'desktop'
}

export function castPage(v: string): Page | null {
  return isPage(v) ? v : null
}

// PBoxApi + 领取跳转；桌面端领取=切换到内置浏览器页，Android=内置/系统浏览器拉起
export interface AppBackend extends PBoxApi {
  openClaim(url: string): Promise<void>
}

function createDesktopBackend(api: PBoxApi): AppBackend {
  return {
    ...api,
    openClaim: async (url) => {
      useBrowserStore.getState().navigateTo(url)
      useUiStore.getState().setPage('browser')
    }
  }
}

function createAndroidBackend(): AppBackend {
  return {
    getData: () => androidGetData(false),
    refreshData: (force?: boolean) => androidGetData(Boolean(force)),
    restoreData: (target) => androidRestoreData(target),
    getConfig: () => androidGetConfig(),
    setConfig: (patch) => androidSetConfig(patch),
    chooseDownloadDir: () => Promise.resolve(null),
    hasActiveDownloads: () => Promise.resolve(false),
    openPath: () => Promise.resolve(false),
    resetBrowserSession: () => androidResetSession(),
    checkUpdate: () => androidCheckUpdate(),
    downloadUpdate: () => Promise.reject(new Error('Android 端请从发布渠道获取更新')),
    installUpdate: () => Promise.resolve(),
    onNavigate: (cb) => androidOnNavigate(cb),
    onDownloadEvent: (cb) => androidOnDownloadEvent(cb),
    onUpdateEvent: (cb) => androidOnUpdateEvent(cb),
    openClaim: async (url) => {
      const config = await androidGetConfig()
      await androidOpenClaim(url, config.androidBrowser)
    }
  }
}

function detectBackend(): AppBackend {
  if (typeof window !== 'undefined' && window.api) return createDesktopBackend(window.api)
  return createAndroidBackend()
}

export const backend: AppBackend = detectBackend()

export async function openClaim(url: string): Promise<void> {
  await backend.openClaim(url)
}
