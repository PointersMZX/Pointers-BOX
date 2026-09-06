// 全平台 API 兼容性审计：
// 1) Electron 22（Win7 版）不存在而 E33 存在的 API —— 出现在 src/ 即为 Win7 隐患
// 2) 主进程浏览器类 API（net.fetch 等）
// 3) 渲染层平台分支完整性
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const roots = ['src/main', 'src/preload', 'src/shared', 'src/renderer/src']
const files = []
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p)
    else if (/\.(ts|tsx|java|mjs)$/.test(name)) files.push(p)
  }
}
roots.forEach(walk)

// Win7（Electron 22 / Chromium 109 / Node 16）下不存在或不稳定的 API
const e22Risky = [
  'net.fetch',
  'AbortSignal.timeout',
  'structuredClone',
  'Object.hasOwn',
  'navigator.userAgentData',
  '.at(',
  'showFileChooser',
  'WebContentsView',
  'contextBridge.exposeInMainWorld(\'electron\''
]
// 主进程里的浏览器 fetch（应使用 requestText/net.request）
const mainFetch = /(^|\W)fetch\s*\(/

let problems = 0
for (const f of files) {
  // 去除行注释后再匹配，避免把说明文字当成 API 使用
  const code = readFileSync(f, 'utf8')
    .split('\n')
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n')
  for (const api of e22Risky) {
    if (code.includes(api)) {
      console.log(`[E22-RISK] ${f} 含 "${api}"`)
      problems++
    }
  }
  if (f.startsWith('src/main') && mainFetch.test(code) && !f.includes('netRequest')) {
    const lines = code.split('\n')
    lines.forEach((l, i) => {
      if (mainFetch.test(l)) {
        console.log(`[MAIN-FETCH] ${f}:${i + 1} -> ${l.trim().slice(0, 80)}`)
        problems++
      }
    })
  }
}

// 安卓工程：自适应图标必须已删除（否则覆盖我们的图标）
import { existsSync } from 'node:fs'
if (existsSync('android/app/src/main/res/mipmap-anydpi-v26')) {
  console.log('[ANDROID-ICON] mipmap-anydpi-v26 仍存在（会覆盖 PNG 图标）')
  problems++
} else {
  console.log('[ANDROID-ICON] 自适应图标 XML 已移除 ✓（启动器回退到用户 PNG）')
}

// 安卓平台页面集合必须包含内置浏览器与下载
const pp = readFileSync('src/shared/platformPages.ts', 'utf8')
if (!/ANDROID_PAGES[^]*'browser'[^]*'downloads'/.test(pp.replace(/\s+/g, ' '))) {
  console.log('[ANDROID-PAGES] 安卓页面集合未包含浏览器/下载（功能缺失）')
  problems++
} else {
  console.log('[ANDROID-PAGES] 安卓页面集合完整 ✓')
}

console.log(problems === 0 ? '\n=== 审计通过：0 个问题 ===' : `\n=== 审计发现 ${problems} 个问题 ===`)
process.exit(problems === 0 ? 0 : 1)
