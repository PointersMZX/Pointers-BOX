// 系统通知（v2.0.0）：下载完成/失败弹系统通知（应用内 Toast 在最小化到托盘时不可见）。
// 点击通知 → 显示并聚焦主窗口 → 跳转下载页。
import { Notification } from 'electron'
import { getMainWindow } from './window'

function isWindowVisibleToUser(): boolean {
  const win = getMainWindow()
  return Boolean(win && win.isVisible() && win.isFocused())
}

export function notifyDownloadDone(filename: string, ok: boolean): void {
  // 窗口在前台时应用内 Toast 已足够，避免双重打扰
  if (isWindowVisibleToUser()) return
  try {
    const n = new Notification({
      title: ok ? '下载完成' : '下载失败',
      body: filename,
      silent: false
    })
    n.on('click', () => {
      const win = getMainWindow()
      if (win) {
        if (win.isMinimized()) win.restore()
        win.show()
        win.focus()
      }
      getMainWindow()?.webContents.send('navigate', 'downloads')
    })
    n.show()
  } catch {
    // 平台不支持通知时静默跳过
  }
}
