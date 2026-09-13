// 平台适配层（开发计划 D6）：renderer 只依赖本模块；桌面实现转发 window.api，Android 实现走 Capacitor
import { Capacitor } from '@capacitor/core'
import type { PBoxApi } from '../../../shared/types'
import { isPage, type Page } from '../../../shared/routes'
import type { AppPlatform } from '../../../shared/platformPages'
import { UPDATE_CHANNEL_INFO } from '../../../shared/updateChannels'
import { useBrowserStore } from '../store/browserStore'
import { useUiStore } from '../store/uiStore'
import {
  ANDROID_APP_VERSION,
  androidCheckUpdate,
  androidGetData,
  androidGetConfig,
  androidGetUserLinks,
  androidImportUserLinks,
  androidOnDownloadEvent,
  androidOnNavigate,
  androidOnUpdateEvent,
  androidOpenClaim,
  androidOpenExternal,
  androidOpenSystemDownloads,
  androidResetSession,
  androidRestoreData,
  androidSetConfig,
  androidSetUserLinks,
  androidExportUserLinks
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
    getAppVersion: () => Promise.resolve(ANDROID_APP_VERSION),
    // 导出/导入与下载历史为桌面端功能；Android 端返回空实现
    exportConfig: () => Promise.resolve(null),
    importConfig: () => Promise.resolve(null),
    listDownloadHistory: () => Promise.resolve([]),
    clearDownloadHistory: () => Promise.resolve(),
    getData: () => androidGetData(false),
    refreshData: (force?: boolean) => androidGetData(Boolean(force)),
    restoreData: (target) => androidRestoreData(target),
    getUserLinks: () => androidGetUserLinks(),
    setUserLinks: (links) => androidSetUserLinks(links),
    importUserLinks: () => androidImportUserLinks(),
    exportUserLinks: () => androidExportUserLinks(),
    getConfig: () => androidGetConfig(),
    setConfig: (patch) => androidSetConfig(patch),
    chooseDownloadDir: () => Promise.resolve(null),
    hasActiveDownloads: () => Promise.resolve(false),
    openPath: () => Promise.resolve(false),
    cancelDownload: () => Promise.resolve(false),
    pauseDownload: () => Promise.resolve(false),
    resumeDownload: () => Promise.resolve(false),
    resetBrowserSession: () => androidResetSession(),
    checkUpdate: () => androidCheckUpdate(),
    // v2.1.0：Android 更新 = 打开所选渠道的 Release 页（APK 走 CI 构建）
    downloadUpdate: async () => {
      const cfg = await androidGetConfig()
      const page =
        cfg.updateChannel === 'github'
          ? UPDATE_CHANNEL_INFO.github.releasePage
          : UPDATE_CHANNEL_INFO.gitee.releasePage
      await androidOpenExternal(page)
    },
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

// 安卓：打开系统下载记录（下载由系统 DownloadManager 接管）
export async function openSystemDownloads(): Promise<void> {
  await androidOpenSystemDownloads()
}

// 安卓：重置内置浏览器会话
export { androidResetSession }
