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
let splashShownAt = 0

/**
 * v2.6.0 启动动画：无边框透明窗，只渲染应用 Logo（无任何矩形/圆形边框底），
 * Logo 大尺寸居中、弹簧曲线弹出（观感对齐 PCL SplashScreen）。
 * 主窗口就绪后等 Logo 完整展示再收起——期间 splash 置顶，不被主窗压住。
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
img{width:208px;height:208px;opacity:0;transform:scale(.66);
animation:splashPop .7s cubic-bezier(.34,1.56,.64,1) .06s forwards}
@keyframes splashPop{to{opacity:1;transform:scale(1)}}
</style></head><body><img src="${logoDataUrl}" alt=""></body></html>`
  splashWindow = new BrowserWindow({
    width: 420,
    height: 420,
    x: undefined,
    y: undefined,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    center: true,
    hasShadow: false,
    skipTaskbar: true,
    // 置顶：主窗 show 时不被压住（收起时一并取消）
    alwaysOnTop: true,
    focusable: false
  })
  splashWindow.once('ready-to-show', () => {
    if (!splashWindow) return
    splashWindow.showInactive()
    splashShownAt = Date.now()
  })
  void splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
}

/**
 * 主窗口就绪后收起启动动画：保证 Logo 至少完整展示 1.4s（弹出动画 0.7s + 停留），
 * 收起与主窗 show 同帧衔接（PCL 式：Logo 消失、界面接上）。
 */
export function dismissSplash(): void {
  if (!splashWindow) return
  const splash = splashWindow
  splashWindow = null
  const MIN_SHOW = 1400
  const remain = Math.max(0, MIN_SHOW - (Date.now() - splashShownAt))
  setTimeout(() => {
    try {
      splash.setFocusable(true)
      splash.blur()
    } catch {
      // 窗口可能已被销毁
    }
    splash.destroy()
  }, remain)
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
