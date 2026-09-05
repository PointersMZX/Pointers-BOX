import { app, BrowserWindow } from 'electron'
import { createMainWindow, createSplashWindow, closeSplash, getMainWindow } from './window'
import { createTray } from './tray'
import { registerIpcHandlers } from './ipc'
import { markQuitting } from './quit'
import { attachWebviewPolicies } from './webviewPolicy'
import { attachDownloadHandling } from './downloads'
import { initUpdater } from './updater'
import { resetBrowserSession } from './sessions'

attachWebviewPolicies()

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const win = getMainWindow()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  })

  void app.whenReady().then(() => {
    // 启动即清一次浏览器会话（PRD 7.3：完全退出后重开应为未登录态，双保险）
    void resetBrowserSession()
    attachDownloadHandling()
    initUpdater()
    registerIpcHandlers()
    createSplashWindow()
    // 渲染层异常时启动动画兜底关闭
    setTimeout(closeSplash, 8000)
    createMainWindow()
    createTray()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })

  // 关闭窗口 = 最小化到托盘（window.ts 内 close → hide），应用保持常驻
  app.on('window-all-closed', () => {
    // 不退出：托盘仍在；完全退出仅通过托盘菜单
  })

  app.on('before-quit', () => {
    markQuitting()
  })
}
