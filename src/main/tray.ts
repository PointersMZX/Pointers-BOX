// 系统托盘（PRD 2.1/2.2）：右键菜单 显示窗口/打开资源库/设置/退出
import { Menu, Tray, app, nativeImage } from 'electron'
import { iconFile } from './paths'
import { isQuitting, markQuitting } from './quit'
import { getMainWindow, createMainWindow } from './window'

let tray: Tray | null = null

export function showWindow(): void {
  const win = getMainWindow() ?? createMainWindow()
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function navigate(page: string): void {
  showWindow()
  getMainWindow()?.webContents.send('navigate', page)
}

export function createTray(): void {
  const icon = nativeImage.createFromPath(iconFile('tray.png'))
  tray = new Tray(icon)
  tray.setToolTip('Pointers-BOX')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示窗口', click: () => showWindow() },
      { label: '打开资源库', click: () => navigate('library') },
      { label: '设置', click: () => navigate('settings') },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          markQuitting()
          app.quit()
        }
      }
    ])
  )
  tray.on('double-click', () => showWindow())
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
