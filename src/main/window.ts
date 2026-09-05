import { BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { iconFile, splashFile } from './paths'
import { isQuitting } from './quit'

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

function windowIconPath(): string | undefined {
  // Windows 端强制使用用户提供的 app.ico；其他平台使用派生 PNG
  const path = process.platform === 'win32' ? iconFile('app.ico') : iconFile('app-icon.png')
  return existsSync(path) ? path : undefined
}

// 启动动画窗口：全屏显示应用图标 + 加载动画
export function createSplashWindow(): void {
  if (!existsSync(splashFile())) return
  splashWindow = new BrowserWindow({
    width: 420,
    height: 480,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#1a365d',
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  splashWindow.once('ready-to-show', () => splashWindow?.show())
  void splashWindow.loadFile(splashFile())
}

export function closeSplash(): void {
  if (splashWindow) {
    splashWindow.destroy()
    splashWindow = null
  }
}

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: 'Pointers-BOX',
    icon: windowIconPath(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      webviewTag: true,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.once('ready-to-show', () => {
    win.show()
    // 保证启动动画至少完整展示 800ms
    setTimeout(closeSplash, 800)
  })
  // PRD 2.2：关闭窗口 = 隐藏到托盘，不退出进程
  win.on('close', (e) => {
    if (!isQuitting()) {
      e.preventDefault()
      win.hide()
    }
  })
  win.on('closed', () => {
    mainWindow = null
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow = win
  return win
}
