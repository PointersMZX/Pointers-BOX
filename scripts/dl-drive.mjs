// CDP 驱动：找到 webview 目标并导航到附件 URL，触发真实下载
// 用法：node scripts/dl-drive.mjs <attachmentUrl>
const DEBUG_PORT = 9223
const url = process.argv[2] ?? 'http://127.0.0.1:51787/file.zip'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function listTargets() {
  const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)
  return res.json()
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    ws.onopen = () => resolve(ws)
    ws.onerror = (e) => reject(new Error('ws error'))
  })
}

let msgId = 0
function send(ws, method, params = {}) {
  return new Promise((resolve) => {
    const id = ++msgId
    const onMsg = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id === id) {
        ws.removeEventListener('message', onMsg)
        resolve(m.result)
      }
    }
    ws.addEventListener('message', onMsg)
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function main() {
  console.log(`[drive] target url: ${url}`)
  let page = null
  for (let i = 0; i < 30; i++) {
    try {
      const targets = await listTargets()
      page = targets.find((t) => t.type === 'page' && t.title.includes('Pointers-BOX'))
      if (page) break
      console.log(`[drive] waiting for main window... (targets: ${targets.map((t) => t.type).join(',')})`)
    } catch {
      console.log('[drive] waiting for debug port...')
    }
    await sleep(1000)
  }
  if (!page) {
    console.error('[drive] FAIL: main window target not found')
    process.exit(1)
  }
  console.log(`[drive] main window found: ${page.title}`)
  const ws = await connect(page.webSocketDebuggerUrl)
  await send(ws, 'Runtime.enable')
  await send(ws, 'Page.enable')

  // 点击侧边栏「浏览器」按钮挂载 webview
  await send(ws, 'Runtime.evaluate', {
    expression: `(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('浏览器')); if (b) { b.click(); return 'clicked' } return 'not-found' })()`
  })
  console.log('[drive] clicked browser nav button')

  // 等待 webview 目标出现
  let webview = null
  for (let i = 0; i < 15; i++) {
    const targets = await listTargets()
    webview = targets.find((t) => t.type === 'webview')
    if (webview) break
    await sleep(1000)
  }
  if (!webview) {
    console.error('[drive] FAIL: webview target not found after clicking nav')
    process.exit(1)
  }
  console.log(`[drive] webview found: ${webview.url}`)
  const wsw = await connect(webview.webSocketDebuggerUrl)
  await send(wsw, 'Page.enable')
  console.log(`[drive] navigating webview to ${url}`)
  await send(wsw, 'Page.navigate', { url })
  console.log('[drive] navigate command sent, waiting 8s for download pipeline...')
  await sleep(8000)
  ws.close()
  wsw.close()
  console.log('[drive] done')
}

main().catch((e) => {
  console.error('[drive] error:', e.message)
  process.exit(1)
})
