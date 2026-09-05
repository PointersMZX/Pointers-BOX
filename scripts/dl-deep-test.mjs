// 下载功能深度 E2E：场景A window.open 下载；场景B 大文件下载中切页
// 前置：附件服务器运行中（51787）、应用已带 --remote-debugging-port=9223 启动
const DEBUG_PORT = 9223
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    ws.onopen = () => resolve(ws)
    ws.onerror = () => reject(new Error('ws error'))
  })
}

let msgId = 0
function send(ws, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId
    const timer = setTimeout(() => reject(new Error('timeout ' + method)), 10000)
    const onMsg = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id === id) {
        clearTimeout(timer)
        ws.removeEventListener('message', onMsg)
        resolve(m.result)
      }
    }
    ws.addEventListener('message', onMsg)
    ws.send(JSON.stringify({ id, method, params }))
  })
}

async function listTargets() {
  const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)
  return res.json()
}

async function findMain() {
  for (let i = 0; i < 20; i++) {
    try {
      const targets = await listTargets()
      const page = targets.find((t) => t.type === 'page' && t.title.includes('Pointers-BOX'))
      if (page) return page
    } catch {}
    await sleep(1000)
  }
  throw new Error('main window not found')
}

async function evalIn(ws, expression) {
  const r = await send(ws, 'Runtime.evaluate', { expression, returnByValue: true })
  return r?.result?.value
}

async function getWebview() {
  for (let i = 0; i < 15; i++) {
    const targets = await listTargets()
    const wv = targets.find((t) => t.type === 'webview')
    if (wv) return wv
    await sleep(1000)
  }
  throw new Error('webview target not found')
}

async function main() {
  const main = await findMain()
  const ws = await connect(main.webSocketDebuggerUrl)
  await send(ws, 'Runtime.enable')
  await send(ws, 'Page.enable')

  // 进入浏览器页
  await evalIn(ws, `[...document.querySelectorAll('button')].find(x => x.textContent.includes('浏览器'))?.click()`)
  await sleep(1500)

  // ── 场景 A：window.open 触发下载 ──
  console.log('===== 场景A：window.open 新窗口下载 =====')
  let wv = await getWebview()
  let wsw = await connect(wv.webSocketDebuggerUrl)
  await send(wsw, 'Page.enable')
  await send(wsw, 'Page.navigate', { url: 'http://127.0.0.1:51787/auto-popup.html' })
  console.log('[A] 已打开 auto-popup 页面，等待 3 秒让 window.open 触发...')
  await sleep(3000)
  // 检查 webview 当前 URL（window.open 被拦截后应仍在原页）
  const evalA = await send(wsw, 'Runtime.evaluate', { expression: 'location.href', returnByValue: true })
  console.log('[A] webview URL:', evalA?.result?.value)
  wsw.close()

  // ── 场景 B：大文件下载中切页 ──
  console.log('===== 场景B：大文件下载中切换到下载页 =====')
  wv = await getWebview()
  wsw = await connect(wv.webSocketDebuggerUrl)
  await send(wsw, 'Page.enable')
  await send(wsw, 'Page.navigate', { url: 'http://127.0.0.1:51787/big.zip' })
  console.log('[B] big.zip 下载已触发，等待 3 秒...')
  await sleep(3000)

  // 切到下载页（webview 将被卸载）
  await evalIn(ws, `[...document.querySelectorAll('button')].find(x => x.textContent.includes('下载'))?.click()`)
  console.log('[B] 已切换到下载页（webview 卸载），等待 5 秒观察任务是否存活...')
  await sleep(5000)

  // 读取下载页任务列表渲染状态
  const taskInfo = await evalIn(ws, `(() => { const t = document.body.innerText; return t.includes('MB') || t.includes('%') ? 'HAS_TASKS' : 'NO_TASKS' })()`)
  console.log('[B] 下载页 UI 状态:', taskInfo)

  // 切回浏览器页，等下载完成
  await evalIn(ws, `[...document.querySelectorAll('button')].find(x => x.textContent.includes('浏览器'))?.click()`)
  console.log('[B] 已切回浏览器页，等待 30 秒让 big.zip 完成...')
  await sleep(30000)

  ws.close()
  console.log('===== 测试流程结束，请检查 E:\\Download 与服务器日志 =====')
}

main().catch((e) => {
  console.error('[E2E] error:', e.message)
  process.exit(1)
})
