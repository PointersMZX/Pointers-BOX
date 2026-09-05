// webview 全局安全与导航策略（PRD 4.2）
//
// 背景（Electron 33 实测）：webview 内的 window.open / target="_blank" 会创建一个
// "待挂载"的新 webview webContents——不触发 setWindowOpenHandler，也永远不加载 URL，
// 导致平台站点"新窗口下载"按钮静默失效（E2E 复现：服务器未收到任何请求）。
//
// 修复：在 guest 内覆写 window.open、拦截 target="_blank" 链接，统一转为当前页
// 导航。附件 URL 的当前页导航会触发 will-download 下载管道且页面不跳走（E2E 验证）。
import { app, session } from 'electron'
import { isHttpUrl } from '../shared/browser'
import { attachDownloadHandling } from './downloads'
import type { WebContents } from 'electron'

// 注入 guest 的脚本：覆写 window.open + 捕获阶段拦截 target="_blank" 链接
const NAV_OVERRIDE_SCRIPT = `(() => {
  if (window.__pboxNavPatched) return
  window.__pboxNavPatched = true
  const origOpen = window.open.bind(window)
  window.open = function (url, target, features) {
    try {
      if (typeof url === 'string' && url.trim() !== '') {
        location.href = url
        return null
      }
      return origOpen(url, target, features)
    } catch {
      return null
    }
  }
  document.addEventListener('click', (e) => {
    const el = e.target
    const a = el && el.closest ? el.closest('a[target="_blank"]') : null
    if (a && a.href) {
      e.preventDefault()
      e.stopPropagation()
      location.href = a.href
    }
  }, true)
})()`

function injectNavOverride(contents: WebContents): void {
  void contents.executeJavaScript(NAV_OVERRIDE_SCRIPT, true).catch(() => {
    // 注入失败（页面限制等）不影响其余功能
  })
}

export function attachWebviewPolicies(): void {
  app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() !== 'webview') return

    // 双保险：确保该 webview 实际使用的会话绑定了下载管道
    attachDownloadHandling(contents.session)

    // window.open / target=_blank → 拒绝创建新窗口，把 URL 引导到当前 webview 加载
    // （对 BrowserWindow 型 contents 生效；webview 型由上面的注入脚本接管）
    contents.setWindowOpenHandler(({ url }) => {
      if (isHttpUrl(url)) void contents.loadURL(url)
      return { action: 'deny' }
    })

    // 禁止离开 http(s)（file:// 等）
    contents.on('will-navigate', (event, url) => {
      if (!isHttpUrl(url)) event.preventDefault()
    })

    // 每次页面就绪/导航后注入导航覆写脚本（覆盖 SPAs 与多页应用）
    contents.on('dom-ready', () => injectNavOverride(contents))
    contents.on('did-navigate', () => injectNavOverride(contents))
    contents.on('did-navigate-in-page', () => injectNavOverride(contents))
  })

  // will-attach-webview 在宿主 webContents 上触发：强制 guest 安全参数与统一分区
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (_event, webPreferences, params) => {
      webPreferences.nodeIntegration = false
      webPreferences.contextIsolation = true
      if (!/^pbox-mem$/.test(params.partition ?? '')) {
        params.partition = 'pbox-mem'
      }
    })
  })

  // 内存分区兜底清理（正常情况下随进程销毁）
  app.on('will-quit', () => {
    try {
      void session.fromPartition('pbox-mem').clearStorageData()
    } catch {
      // 退出阶段清理失败无需处理
    }
  })
}
