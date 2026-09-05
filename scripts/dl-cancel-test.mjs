// 场景C：取消下载 E2E
// 前置：dl-test-server.mjs 运行中（51787）、应用带 --remote-debugging-port=9223
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

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

async function evalIn(ws, expression) {
  const r = await send(ws, 'Runtime.evaluate', { expression, returnByValue: true })
  return r?.result?.value
}

function psFileExists(name) {
  const r = spawnSync('powershell', [
    '-NoProfile',
    '-Command',
    `Test-Path "E:\\Download\\${name}"`
  ], { encoding: 'utf-8' })
  return r.stdout.trim() === 'True'
}

async function main() {
  // 找主窗口
  let main = null
  for (let i = 0; i < 20; i++) {
    try {
      const targets = await listTargets()
      main = targets.find((t) => t.type === 'page' && t.title.includes('Pointers-BOX'))
      if (main) break
    } catch {}
    await sleep(1000)
  }
  if (!main) throw new Error('main window not found')
  const ws = await connect(main.webSocketDebuggerUrl)
  await send(ws, 'Runtime.enable')
  await send(ws, 'Page.enable')

  // 确保起点干净
  const preCheck = psFileExists('pbox-e2e-big.zip') || psFileExists('pbox-e2e-big(1).zip') || psFileExists('pbox-e2e-big(2).zip')
  if (preCheck) {
    console.log('[C] 警告：E:\\Download 已有 big.zip 残留，结果判定会受影响')
  }

  // 进入浏览器页 → 触发 big.zip
  await evalIn(ws, `[...document.querySelectorAll('button')].find(x => x.textContent.includes('浏览器'))?.click()`)
  await sleep(1500)
  let webview = null
  for (let i = 0; i < 15; i++) {
    const targets = await listTargets()
    webview = targets.find((t) => t.type === 'webview')
    if (webview) break
    await sleep(1000)
  }
  if (!webview) throw new Error('webview not found')
  const wsw = await connect(webview.webSocketDebuggerUrl)
  await send(wsw, 'Page.enable')
  await send(wsw, 'Page.navigate', { url: 'http://127.0.0.1:51787/big.zip' })
  console.log('[C] big.zip 已触发，等 3 秒...')
  await sleep(3000)

  // 切到下载页
  await evalIn(ws, `[...document.querySelectorAll('button')].find(x => x.textContent.includes('下载'))?.click()`)
  await sleep(1500)

  // 验证任务存在
  const hasTask = await evalIn(ws, `document.body.innerText.includes('pbox-e2e-big')`)
  console.log('[C] 下载页任务可见:', hasTask)

  // 点击取消按钮
  const clicked = await evalIn(ws, `(() => { const b = document.querySelector('button[aria-label="取消下载"]'); if (b) { b.click(); return true } return false })()`)
  console.log('[C] 已点击取消按钮:', clicked)
  await sleep(2500)

  // 验证：任务消失
  const afterCancel = await evalIn(ws, `(() => ({ hasTask: document.body.innerText.includes('pbox-e2e-big'), empty: document.body.innerText.includes('暂无进行中的下载') }))()`)
  console.log('[C] 取消后 UI 状态:', JSON.stringify(afterCancel))

  // 验证：半成品文件已被清理
  const leftover = psFileExists('pbox-e2e-big.zip') || psFileExists('pbox-e2e-big(1).zip') || psFileExists('pbox-e2e-big(2).zip')
  console.log('[C] 半成品文件已清理:', !leftover)

  // 验证：取消后可以更改下载路径（路径锁定解除）
  const changeEnabled = await evalIn(ws, `(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes('更改')); return b ? !b.disabled : 'not-found' })()`)
  console.log('[C] 取消后「更改路径」按钮恢复可用:', changeEnabled)

  const pass = clicked && !afterCancel.hasTask && afterCancel.empty && !leftover
  console.log(pass ? '===== 场景C 取消下载：PASS =====' : '===== 场景C 取消下载：FAIL =====')
  ws.close()
  if (!pass) process.exit(1)
}

main().catch((e) => {
  console.error('[E2E-C] error:', e.message)
  process.exit(1)
})
