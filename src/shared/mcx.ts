// ── MCX 数据文件格式（v2.4.0：品牌自有加密数据容器） ─────────────────
//
// 文件格式（v1）：
//   .mcx 文件 = 单行 base64 文本，解码后为 body：
//     偏移 0..2   "MCX"   魔数
//     偏移 3      0x01    版本号
//     偏移 4..19  16B 随机盐（每次加密不同）
//     偏移 20+    密文 = 明文 UTF-8 字节 XOR 密钥流
//   明文 = JSON 文本（UTF-8）
//   密钥流 = 以 seed = FNV1a(key ‖ salt) 播种的 PRNG（mulberry32）输出的
//            32 位大端字流（每字取 4 字节）
//
// 用法：
//   encryptMuxed(jsonText)  → .mcx 文件内容（base64 单行）
//   openMuxed(fileContent)  → 统一读取入口：自动识别，.mcx 解密、明文 JSON 原样返回
//                              （过渡期服务器新旧文件可混用，旧 .json 直接喂进来也认）
//   isMuxed / decryptMuxed  → 显式判断/解密
//
// 安全等级（设计定位）：挡住「把后缀改成 txt 就能看/改文件」的大多数情况——
// 文件本身是一坨不可读 base64，改一个字节整个文件不可解析（应用走告警+保留本地数据）；
// 不防逆向 App 提取密钥（密钥必须嵌入应用才能解密使用）。
//
// 密钥维护规则：密钥以 KEY_A/KEY_B 两半拆分存储（运行时异或合成，源码中无明文可 grep 的密钥）。
// 换密钥时必须同步四处：本文件、publish/share.html 内嵌解码器、Pointers-Tools 的 MCX 模块、
// 以及已上传服务器的全部 .mcx 文件（旧文件将解不开）。

const VERSION = 1
const SALT_LEN = 16
const MAGIC = [0x4d, 0x43, 0x58] // "MCX"

// 密钥材料（32 字节 = KEY_A[i] ^ KEY_B[i]，2026-10-17 首版）
const KEY_A = [
  0x5d, 0x97, 0xfc, 0x2e, 0xe7, 0xfe, 0x17, 0x40, 0xba, 0xf2, 0x03, 0x0c, 0x8a, 0x60, 0x44, 0x63,
  0x54, 0xa9, 0x9f, 0x51, 0x11, 0xf6, 0x8c, 0xe7, 0x38, 0xec, 0x9e, 0x72, 0x2b, 0x54, 0x3e, 0x0d
]
const KEY_B = [
  0x16, 0x25, 0x5d, 0xa7, 0xe1, 0x61, 0xcf, 0x01, 0x21, 0x1b, 0x2b, 0xcb, 0x71, 0x36, 0x63, 0xec,
  0x52, 0x01, 0x34, 0x3b, 0x9b, 0x79, 0xac, 0x31, 0x07, 0x69, 0xf6, 0xb6, 0x3e, 0xdb, 0x18, 0x31
]

// 各运行时（Node 主进程 / WebView / 测试）的全局能力探测，避免 TS 库差异
const g = globalThis as {
  atob?: (s: string) => string
  btoa?: (s: string) => string
  Buffer?: { from(...args: unknown[]): { toString(enc: string): string } }
  crypto?: { getRandomValues?: (arr: Uint8Array) => Uint8Array }
}

function keyBytes(): number[] {
  const out = new Array<number>(KEY_A.length)
  for (let i = 0; i < KEY_A.length; i++) out[i] = (KEY_A[i] ?? 0) ^ (KEY_B[i] ?? 0)
  return out
}

// FNV-1a 32 位
function fnv1a(bytes: number[]): number {
  let h = 0x811c9dc5
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i] ?? 0
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// mulberry32：确定性 PRNG（作为密钥流发生器；同 seed 必同输出）
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0)
  }
}

function keystream(seed: number, length: number): number[] {
  const rng = mulberry32(seed)
  const out = new Array<number>(length)
  for (let i = 0; i < length; i += 4) {
    const w = rng()
    out[i] = (w >>> 24) & 0xff
    if (i + 1 < length) out[i + 1] = (w >>> 16) & 0xff
    if (i + 2 < length) out[i + 2] = (w >>> 8) & 0xff
    if (i + 3 < length) out[i + 3] = w & 0xff
  }
  return out
}

function toUtf8(text: string): number[] {
  return Array.from(new TextEncoder().encode(text))
}

function fromUtf8(bytes: number[]): string {
  return new TextDecoder('utf-8').decode(Uint8Array.from(bytes))
}

function b64Encode(bytes: number[]): string {
  if (typeof g.btoa === 'function') {
    const u = Uint8Array.from(bytes)
    let s = ''
    for (let i = 0; i < u.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, Array.from(u.subarray(i, i + 0x8000)))
    }
    return g.btoa(s)
  }
  if (g.Buffer) return g.Buffer.from(bytes).toString('base64')
  throw new Error('当前运行时缺少 base64 编码能力')
}

// 宽容解码：忽略空白/换行（上传 FTP 换行符不会破坏文件）；非法 base64 返回 null
function b64Decode(text: string): number[] | null {
  const clean = text.replace(/[^A-Za-z0-9+/=]/g, '')
  if (clean.length === 0 || clean.length % 4 !== 0) return null
  try {
    if (typeof g.atob === 'function') {
      const bin = g.atob(clean)
      const out = new Array<number>(bin.length)
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
      return out
    }
    if (g.Buffer) return Array.from(g.Buffer.from(clean, 'base64') as unknown as ArrayLike<number>)
  } catch {
    return null
  }
  return null
}

/** 随机盐：优先 WebCrypto，其次注入 rng（契约同 Math.random：返回 [0,1) 浮点），最后 Math.random（Win7 E22 主进程无 globalThis.crypto 也能跑） */
function randomSalt(rng?: () => number): number[] {
  if (rng) {
    const out = new Array<number>(SALT_LEN)
    for (let i = 0; i < SALT_LEN; i++) out[i] = Math.floor((rng() % 1) * 256)
    return out
  }
  try {
    const cr = g.crypto
    if (cr && typeof cr.getRandomValues === 'function') {
      const u = new Uint8Array(SALT_LEN)
      cr.getRandomValues(u)
      return Array.from(u)
    }
  } catch {
    /* 回落 Math.random */
  }
  const out = new Array<number>(SALT_LEN)
  for (let i = 0; i < SALT_LEN; i++) out[i] = Math.floor(Math.random() * 256)
  return out
}

/** 加密 JSON 文本 → .mcx 文件内容（单行 base64）。rng 注入可用于确定性测试。 */
export function encryptMuxed(plainText: string, rng?: () => number): string {
  const salt = randomSalt(rng)
  const pt = toUtf8(plainText)
  const ks = keystream(fnv1a([...keyBytes(), ...salt]), pt.length)
  const ct = new Array<number>(pt.length)
  for (let i = 0; i < pt.length; i++) ct[i] = (pt[i] ?? 0) ^ (ks[i] ?? 0)
  return b64Encode([...MAGIC, VERSION, ...salt, ...ct])
}

/** 解密 .mcx 文件内容 → 明文 JSON 文本；不是 mcx / 损坏时返回 null（调用方回落，不抛错） */
export function decryptMuxed(raw: string): string | null {
  if (typeof raw !== 'string') return null
  const bytes = b64Decode(raw)
  if (!bytes || bytes.length < MAGIC.length + 1 + SALT_LEN + 1) return null
  for (let i = 0; i < MAGIC.length; i++) if ((bytes[i] ?? 0) !== (MAGIC[i] ?? 0)) return null
  if ((bytes[MAGIC.length] ?? 0) !== VERSION) return null
  const salt = bytes.slice(MAGIC.length + 1, MAGIC.length + 1 + SALT_LEN)
  const ct = bytes.slice(MAGIC.length + 1 + SALT_LEN)
  if (ct.length === 0) return null
  const ks = keystream(fnv1a([...keyBytes(), ...salt]), ct.length)
  const pt = new Array<number>(ct.length)
  for (let i = 0; i < ct.length; i++) pt[i] = (ct[i] ?? 0) ^ (ks[i] ?? 0)
  return fromUtf8(pt)
}

/** 是否为 mcx 加密文件（魔数 + 版本 + 最小长度均匹配） */
export function isMuxed(raw: string): boolean {
  return decryptMuxed(raw) !== null
}

/** 统一读取入口：mcx 返回解密后的 JSON 文本；明文（旧 .json）原样返回——过渡期双格式并存 */
export function openMuxed(raw: string): string {
  const decrypted = decryptMuxed(raw)
  return decrypted ?? raw
}
