// 平台适配层（开发计划 D6）：renderer 只依赖本模块；桌面实现转发 window.api，Android 实现走 Capacitor
import { Capacitor } from '@capacitor/core'
import type { PBoxApi, Resource } from '../../../shared/types'
import { isPage, type Page } from '../../../shared/routes'
import type { AppPlatform } from '../../../shared/platformPages'
import { UPDATE_CHANNEL_INFO } from '../../../shared/updateChannels'
import { buildShareText } from '../../../shared/share'
import { useBrowserStore } from '../store/browserStore'
import { useUiStore } from '../store/uiStore'
import {
  ANDROID_APP_VERSION,
  androidCancelDownload,
  androidCheckUpdate,
  androidCopyText,
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
  androidShareText,
  androidExportUserLinks
} from './capacitor'

export function currentPlatform(): AppPlatform {
  if (typeof window !== 'undefined' && window.api) return 'desktop'
  return Capacitor.isNativePlatform() ? 'android' : 'desktop'
}

export function castPage(v: string): Page | null {
  return isPage(v) ? v : null
}

// PBoxApi + 领取跳转 + 平台绑定分享（v2.4.0）；桌面端领取=切换到内置浏览器页，Android=系统浏览器拉起（v2.3.0）
export interface AppBackend extends PBoxApi {
  openClaim(url: string): Promise<void>
  /**
   * v2.4.0 平台绑定分享：生成「平台分享页」链接文本（不含资源真实链接）。
   * 返回 'shared'=安卓系统分享面板已拉起（无需 toast）；'copied'=已复制剪贴板（桌面恒为此；
   * 安卓无分享目标/失败时为兜底复制），调用方据此给「已复制」反馈。
   */
  shareResource(resource: Resource): Promise<'shared' | 'copied'>
}

function createDesktopBackend(api: PBoxApi): AppBackend {
  return {
    ...api,
    openClaim: async (url) => {
      useBrowserStore.getState().navigateTo(url)
      useUiStore.getState().setPage('browser')
    },
    // v2.4.0：桌面端分享=复制平台分享文本到系统剪贴板（主进程 clipboard，clipboard:copy IPC）
    shareResource: async (resource) => {
      await api.copyText(buildShareText(resource))
      return 'copied'
    }
  }
}

function createAndroidBackend(): AppBackend {
  return {
    getAppVersion: () => Promise.resolve(ANDROID_APP_VERSION),
    // 导出/导入为桌面端功能；下载历史记录在系统 DownloadManager（App 内历史卡 Android 隐藏）
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
    // Android 下载走系统 DownloadManager 固定 Downloads 目录，不可自选；"打开文件夹"=系统下载记录
    chooseDownloadDir: () => Promise.resolve(null),
    hasActiveDownloads: () => Promise.resolve(false),
    openPath: async () => {
      await androidOpenSystemDownloads().catch(() => {})
      return false
    },
    // v2.5.0：下载真恢复——事件（真进度）与取消接原生桥；暂停/恢复 DownloadManager 不支持，拒绝即可（UI 已隐藏）
    cancelDownload: (id) => androidCancelDownload(Number(id)),
    pauseDownload: () => Promise.resolve(false),
    resumeDownload: () => Promise.resolve(false),
    // v2.5.0：内嵌浏览器恢复，会话重置接原生
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
    // v2.5.0：下载事件真桥（started/progress/done → 渲染层 DownloadTask）
    onDownloadEvent: (cb) => androidOnDownloadEvent(cb),
    onUpdateEvent: (cb) => androidOnUpdateEvent(cb),
    // v2.5.0：按设置分流——内置 → 原生 InAppBrowserActivity；系统 → ACTION_VIEW
    openClaim: async (url) => {
      const cfg = await androidGetConfig()
      await androidOpenClaim(url, cfg.androidBrowser)
    },
    // v2.4.0：分享=原生 Share 插件系统分享面板（回落复制由原生侧决定返回 mode）
    copyText: (text) => androidCopyText(text),
    shareResource: (resource) => androidShareText(buildShareText(resource))
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

/** v2.4.0 平台绑定分享（双端统一入口，弹窗「分享」按钮调用） */
export function shareResource(resource: Resource): Promise<'shared' | 'copied'> {
  return backend.shareResource(resource)
}
