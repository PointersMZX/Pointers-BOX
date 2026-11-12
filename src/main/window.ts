import { BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { iconFile } from './paths'
import { isQuitting } from './quit'

let mainWindow: BrowserWindow | null = null

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

function windowIconPath(): string | undefined {
  // Windows 端强制使用用户提供的 app.ico；其他平台使用派生 PNG
  const path = process.platform === 'win32' ? iconFile('app.ico') : iconFile('app-icon.png')
  return existsSync(path) ? path : undefined
}

let splashWindow: BrowserWindow | null = null

/**
 * v2.6.0 启动动画：无边框透明小窗，只渲染应用 Logo（无任何矩形/圆形边框底），
 * Logo 以弹簧曲线弹出；主窗口就绪后自动收起（观感对齐 PCL SplashScreen）。
 */
export function createSplashWindow(): void {
  if (splashWindow) return
  let logoDataUrl = ''
  try {
    const icon = iconFile('app-icon.png')
    if (existsSync(icon)) {
      logoDataUrl = `data:image/png;base64,${readFileSync(icon).toString('base64')}`
    }
  } catch {
    // 图标缺失时跳过启动动画
  }
  if (!logoDataUrl) return
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:transparent;overflow:hidden}
body{display:flex;align-items:center;justify-content:center}
img{width:128px;height:128px;opacity:0;transform:scale(.72);
animation:splashPop .62s cubic-bezier(.34,1.56,.64,1) .05s forwards}
@keyframes splashPop{to{opacity:1;transform:scale(1)}}
</style></head><body><img src="${logoDataUrl}" alt=""></body></html>`
  splashWindow = new BrowserWindow({
    width: 240,
    height: 240,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    center: true,
    hasShadow: false,
    skipTaskbar: true,
    focusable: false
  })
  splashWindow.once('ready-to-show', () => {
    splashWindow?.showInactive()
  })
  void splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
}

/** 主窗口就绪后收起启动动画（留出 Logo 完整弹出的时间） */
export function dismissSplash(): void {
  if (!splashWindow) return
  const splash = splashWindow
  splashWindow = null
  setTimeout(() => splash.destroy(), 420)
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
    dismissSplash()
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
