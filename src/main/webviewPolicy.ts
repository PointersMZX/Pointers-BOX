import { app, session } from 'electron'
import { isHttpUrl } from '../shared/browser'
import { attachDownloadHandling } from './downloads'

// webview 全局安全与导航策略（PRD 4.2）：新窗口保持在当前 webview 内打开
export function attachWebviewPolicies(): void {
  app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() !== 'webview') return

    // 双保险：确保该 webview 实际使用的会话绑定了下载管道（正常应与 pbox-mem 一致）
    attachDownloadHandling(contents.session)

    // window.open / target=_blank → 拦截后在同一 webview 内导航
    contents.setWindowOpenHandler(({ url }) => {
      if (isHttpUrl(url)) void contents.loadURL(url)
      return { action: 'deny' }
    })

    // 禁止离开 http(s)（file:// 等）
    contents.on('will-navigate', (event, url) => {
      if (!isHttpUrl(url)) event.preventDefault()
    })

    // webview 内禁止加载 Node 集成
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
