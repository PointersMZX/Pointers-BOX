// 内置浏览器共享常量与地址栏归一化（PRD 4.2）
export const DEFAULT_START_URL = 'https://pointers-box.cc.cd/'

// 会话重置清除的存储类型（PRD 4.2 重置触发条件）
export const RESET_STORAGES = [
  'cookies',
  'localstorage',
  'cachestorage',
  'indexdb',
  'serviceworkers',
  'shadercache',
  'websql',
  'filesystem'
] as const

const KNOWN_SCHEME_RE = /^(https?|about|file|chrome|ftp|wss?):/i
const LOCALHOST_RE = /^localhost(:\d+)?([/?#].*)?$/i
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}(:\d+)?([/?#].*)?$/

// 地址栏手动输入归一化：localhost/IP 用 http；已知协议原样保留；
// 疑似域名补 https；其余当搜索词
export function normalizeAddressInput(input: string): string {
  const text = input.trim()
  if (text === '') return DEFAULT_START_URL
  if (LOCALHOST_RE.test(text) || IPV4_RE.test(text)) return `http://${text}`
  if (KNOWN_SCHEME_RE.test(text)) return text
  if (!/\s/.test(text) && text.includes('.')) return `https://${text}`
  return `https://www.bing.com/search?q=${encodeURIComponent(text)}`
}

// 仅允许 http(s) 在 webview 内导航（file://、自定义协议一律拒绝）
export function isHttpUrl(url: string): boolean {
  return /^https?:/i.test(url)
}
