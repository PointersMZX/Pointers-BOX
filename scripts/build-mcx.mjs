// v2.4.0 MCX：把 resources/box.json（明文源）加密为 resources/box.mcx（包内嵌入兜底文件）
// electron-builder.yml 的 extraResources 引用 box.mcx；本脚本在打包前自动运行
// （package* / build:win 均已接线）。加密算法与 src/shared/mcx.ts 完全一致，
// 一致性由 tests/mcx.test.ts 交叉校验（box.mcx 解密结果 === box.json）。
// 用法：node scripts/build-mcx.mjs [--check]（--check 仅校验不写入，CI/测试用）
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

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

function keyBytes() {
  return KEY_A.map((b, i) => b ^ KEY_B[i])
}

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

function encryptMuxed(plainText, rng) {
  const salt = new Array(SALT_LEN)
  for (let i = 0; i < SALT_LEN; i++) salt[i] = Math.floor((rng ? rng() : Math.random()) * 256)
  const pt = Buffer.from(plainText, 'utf-8')
  const ks = keystream(fnv1a([...keyBytes(), ...salt]), pt.length)
  const body = [...MAGIC, VERSION, ...salt]
  for (let i = 0; i < pt.length; i++) body.push(pt[i] ^ (ks[i] ?? 0))
  return Buffer.from(body).toString('base64')
}

// 与 src/shared/mcx.ts 同款解密（脚本自校验用，防“加密写坏”）
function decryptMuxed(raw) {
  const bytes = [...Buffer.from(raw.replace(/[^A-Za-z0-9+/=]/g, ''), 'base64')]
  if (bytes.length < MAGIC.length + 1 + SALT_LEN + 1) return null
  if (MAGIC.some((m, i) => bytes[i] !== m)) return null
  if (bytes[MAGIC.length] !== VERSION) return null
  const salt = bytes.slice(MAGIC.length + 1, MAGIC.length + 1 + SALT_LEN)
  const ct = bytes.slice(MAGIC.length + 1 + SALT_LEN)
  const ks = keystream(fnv1a([...keyBytes(), ...salt]), ct.length)
  return Buffer.from(ct.map((b, i) => b ^ (ks[i] ?? 0))).toString('utf-8')
}

const base = process.cwd()
const srcPath = join(base, 'resources', 'box.json')
const dstPath = join(base, 'resources', 'box.mcx')
const checkOnly = process.argv.includes('--check')

if (!existsSync(srcPath)) {
  console.error(`未找到源文件 ${srcPath}`)
  process.exit(1)
}
const plain = readFileSync(srcPath, 'utf-8')

if (checkOnly) {
  if (!existsSync(dstPath)) {
    console.error('resources/box.mcx 不存在（先运行 node scripts/build-mcx.mjs 生成）')
    process.exit(1)
  }
  const roundTrip = decryptMuxed(readFileSync(dstPath, 'utf-8'))
  if (roundTrip === null || roundTrip !== plain) {
    console.error('box.mcx 与 box.json 不一致（或已损坏），请重新生成：node scripts/build-mcx.mjs')
    process.exit(1)
  }
  console.log(`box.mcx 校验通过（${statSync(dstPath).size} bytes，解密内容与 box.json 一致）`)
  process.exit(0)
}

const out = encryptMuxed(plain)
if (decryptMuxed(out) !== plain) {
  console.error('自校验失败：加密→解密不一致，中止写入（算法实现有误）')
  process.exit(1)
}
writeFileSync(dstPath, out, 'utf-8')
console.log(`box.mcx 已生成（${statSync(dstPath).size} bytes，自校验通过）`)
