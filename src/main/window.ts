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
let splashCreatedAt = 0
let splashGone = false
let mainReady = false
// PCL 观感：Logo 先独占（干净桌面之上）展示满此时长，主窗再接上并淡出 Logo
const SPLASH_DURATION = 1800

/** 揭示主窗：主窗已就绪 且 Logo 已展示满 SPLASH_DURATION 时——show 主窗 + 淡出 Logo */
function tryReveal(): void {
  if (!mainReady) return
  if (splashCreatedAt !== 0 && Date.now() - splashCreatedAt < SPLASH_DURATION) return
  getMainWindow()?.show()
  dismissSplash()
}

/**
 * v2.6.0 启动动画：无边框透明窗，只渲染应用 Logo（无任何矩形/圆形边框底），
 * Logo 大尺寸居中、弹簧曲线弹出（观感对齐 PCL SplashScreen）。
 *
 * 关键（v2.6.0 修复「Logo 不出现」）：
 * 1. 创建后【立即】showInactive，不再等 ready-to-show——旧实现 Logo 数据（近 1MB base64）
 *    解析慢，主窗 ready-to-show 先触发时 splashShownAt 仍为 0，dismiss 计算 remain=0，
 *    结果 Logo 尚未上屏就被 destroy（"始终没出现"的根因）。
 * 2. 最短可见时间从【创建时刻】起算，且永不"未显示就销毁"——即使主窗秒就绪也保底展示。
 * 3. 5s 安全兜底：主窗异常没触发 dismiss 时也能收起，不卡死。
 */
export function createSplashWindow(): void {
  if (splashWindow) return
  let logoDataUrl = ''
  try {
    // v2.6.0：启动只用纯 Logo（P+星，透明底），不显示方形 App 图标；
    // 优先 logo-splash.png（抠好的透明 Logo），缺失时回退完整 app-icon.png
    let icon = iconFile('logo-splash.png')
    if (!existsSync(icon)) icon = iconFile('app-icon.png')
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
img{width:216px;height:216px;opacity:0;transform:scale(.66);
animation:splashPop .7s cubic-bezier(.34,1.56,.64,1) .06s forwards}
@keyframes splashPop{to{opacity:1;transform:scale(1)}}
</style></head><body><img src="${logoDataUrl}" alt=""></body></html>`
  splashWindow = new BrowserWindow({
    width: 420,
    height: 420,
    show: false,
    frame: false,
    transparent: true,
    // 关键：不显式设全透明背景，Windows 下默认白底会让"透明区"渲染成白色实心方块
    //（用户实测 Logo 不出现、只见白框的根因），必须 #00000000 让透明区真正透出桌面
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    center: true,
    hasShadow: false,
    skipTaskbar: true,
    // 置顶：主窗 show 时不被压住（收起时一并取消）
    alwaysOnTop: true,
    focusable: false
  })
  splashCreatedAt = Date.now()
  // 立即上屏（透明窗先出现，Logo 数据解析完成后按动画淡入）——不等 ready-to-show
  splashWindow.showInactive()
  void splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  // Logo 独占展示满 SPLASH_DURATION 后 reveal 主窗（主窗 ready-to-show 也会调 tryReveal，双保险）
  setTimeout(tryReveal, SPLASH_DURATION)
  // 6s 安全兜底：主窗异常没就绪也能收起透明窗，不卡死
  setTimeout(() => dismissSplash(true), 6000)
}

/**
 * 收起启动动画：PCL 式 0.25s 淡出后销毁。幂等、可安全重复调用；
 * force 时立即销毁（6s 安全兜底用）。展示时长由 tryReveal 统一把关。
 */
export function dismissSplash(force = false): void {
  if (!splashWindow || splashGone) return
  const splash = splashWindow
  splashWindow = null
  splashGone = true
  if (!force) {
    try {
      void splash.webContents.executeJavaScript(
        "const b=document.body;if(b){b.style.transition='opacity .25s ease';b.style.opacity='0';}"
      )
    } catch {
      // 内容未就绪时直接销毁，不影响主流程
    }
  }
  setTimeout(() => {
    try {
      if (!splash.isDestroyed()) splash.destroy()
    } catch {
      // 窗口可能已被销毁
    }
  }, force ? 0 : 260)
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
    // 不再立即 show：先让 Logo 独占展示，达到 SPLASH_DURATION 再 reveal（PCL 观感）
    mainReady = true
    tryReveal()
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
