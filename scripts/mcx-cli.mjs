// v2.4.0 MCX 命令行工具：加密本地 JSON → .mcx（上传服务器用）/ 解密 .mcx → 明文查看
// 用法（项目根目录运行）：
//   node scripts/mcx-cli.mjs enc <input.json> [-o <output.mcx>]   加密（默认输出同名 .mcx）
//   node scripts/mcx-cli.mjs dec <input.mcx> [-o <output.json>]  解密（默认输出同名 .json）
//   node scripts/mcx-cli.mjs view <input.mcx>                    打印明文到控制台（直接看内容）
// 算法/密钥与 src/shared/mcx.ts、scripts/build-mcx.mjs、publish/share.html 完全一致；
// 换密钥时五处同步（含 Pointers-Tools 的 MCX 模块）。
import { readFileSync, writeFileSync } from 'node:fs'
import { join, basename } from 'node:path'

const KEY_A = [
  0x5d, 0x97, 0xfc, 0x2e, 0xe7, 0xfe, 0x17, 0x40, 0xba, 0xf2, 0x03, 0x0c, 0x8a, 0x60, 0x44, 0x63,
  0x54, 0xa9, 0x9f, 0x51, 0x11, 0xf6, 0x8c, 0xe7, 0x38, 0xec, 0x9e, 0x72, 0x2b, 0x54, 0x3e, 0x0d
]
const KEY_B = [
  0x16, 0x25, 0x5d, 0xa7, 0xe1, 0x61, 0xcf, 0x01, 0x21, 0x1b, 0x2b, 0xcb, 0x71, 0x36, 0x63, 0xec,
  0x52, 0x01, 0x34, 0x3b, 0x9b, 0x79, 0xac, 0x31, 0x07, 0x69, 0xf6, 0xb6, 0x3e, 0xdb, 0x18, 0x31
]
const MAGIC = [0x4d, 0x43, 0x58] // "MCX"
const VERSION = 1
const SALT_LEN = 16

const keyBytes = () => KEY_A.map((b, i) => b ^ KEY_B[i])

function fnv1a(bytes) {
  let h = 0x811c9dc5
  for (const b of bytes) {
    h ^= b
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return (t ^ (t >>> 14)) >>> 0
  }
}

function keystream(seed, length) {
  const rng = mulberry32(seed)
  const out = new Array(length)
  for (let i = 0; i < length; i += 4) {
    const w = rng()
    out[i] = (w >>> 24) & 0xff
    if (i + 1 < length) out[i + 1] = (w >>> 16) & 0xff
    if (i + 2 < length) out[i + 2] = (w >>> 8) & 0xff
    if (i + 3 < length) out[i + 3] = w & 0xff
  }
  return out
}

function encrypt(plainText) {
  const salt = new Array(SALT_LEN)
  for (let i = 0; i < SALT_LEN; i++) salt[i] = Math.floor(Math.random() * 256)
  const pt = Buffer.from(plainText, 'utf-8')
  const ks = keystream(fnv1a([...keyBytes(), ...salt]), pt.length)
  const body = [...MAGIC, VERSION, ...salt]
  for (let i = 0; i < pt.length; i++) body.push(pt[i] ^ (ks[i] ?? 0))
  return Buffer.from(body).toString('base64')
}

function decrypt(raw) {
  const bytes = [...Buffer.from(raw.replace(/[^A-Za-z0-9+/=]/g, ''), 'base64')]
  if (bytes.length < MAGIC.length + 1 + SALT_LEN + 1) return null
  if (MAGIC.some((m, i) => bytes[i] !== m)) return null
  if (bytes[MAGIC.length] !== VERSION) return null
  const salt = bytes.slice(MAGIC.length + 1, MAGIC.length + 1 + SALT_LEN)
  const ct = bytes.slice(MAGIC.length + 1 + SALT_LEN)
  const ks = keystream(fnv1a([...keyBytes(), ...salt]), ct.length)
  return Buffer.from(ct.map((b, i) => b ^ (ks[i] ?? 0))).toString('utf-8')
}

const [,, cmd, inFileRaw, ...rest] = process.argv
const outIdx = rest.indexOf('-o')
const outFile = outIdx >= 0 ? rest[outIdx + 1] : null
const inFile = inFileRaw

if (!cmd || !inFile) {
  console.log('用法：node scripts/mcx-cli.mjs <enc|dec|view> <文件> [-o 输出]')
  process.exit(cmd ? 1 : 0)
}

if (cmd === 'enc') {
  const plain = readFileSync(inFile, 'utf-8')
  try {
    JSON.parse(plain)
  } catch {
    console.error(`⚠ ${inFile} 不是合法 JSON（mcx 容器只包 JSON 文本，仍会照加密）`)
  }
  const out = outFile ?? inFile.replace(/\.[^.]+$/, '') + '.mcx'
  const encOut = encrypt(plain)
  writeFileSync(out, encOut)
  console.log(`已加密 ${inFile} → ${out}（明文 ${Buffer.byteLength(plain)} B → 密文 ${encOut.length} 字符 base64）`)
  process.exit(0)
}

const raw = readFileSync(inFile, 'utf-8')
const plain = decrypt(raw)
if (plain === null) {
  if (JSON.parse(raw)) {
    console.log('（输入是明文 JSON，非 mcx——原样输出）')
  } else {
    console.error(`无法解密 ${inFile}（不是 mcx 文件）`)
    process.exit(1)
  }
}
if (cmd === 'view') {
  console.log(plain === null ? raw : plain)
} else if (cmd === 'dec') {
  const out = outFile ?? inFile.replace(/\.[^.]+$/, '') + '.json'
  writeFileSync(out, plain === null ? raw : plain)
  console.log(`已解密 ${inFile} → ${out}`)
} else {
  console.error(`未知命令 ${cmd}`)
  process.exit(1)
}
