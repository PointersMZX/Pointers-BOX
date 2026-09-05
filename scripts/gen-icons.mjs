// 从用户提供的 app-icon.png（512x512）派生全部平台图标。
// 不覆盖用户提供的 app.ico 与 app-icon.png；PNG 不可解码时退回程序绘制图标。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodePng, encodePng, resizeBilinear, drawIcon } from './iconlib.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const iconsDir = join(root, 'resources', 'icons')
mkdirSync(join(iconsDir, 'linux'), { recursive: true })
mkdirSync(join(iconsDir, 'android'), { recursive: true })

const sourcePngPath = join(iconsDir, 'app-icon.png')

let base = null
let source = 'user-provided app-icon.png'
try {
  const decoded = decodePng(readFileSync(sourcePngPath))
  base = { width: decoded.width, height: decoded.height, rgba: decoded.rgba }
} catch (err) {
  source = `fallback-generated（原图解码失败: ${err.message}）`
}

function scaled(size) {
  if (!base) return drawIcon(size)
  const img = resizeBilinear(base, size, size)
  return encodePng(img.width, img.height, img.rgba)
}

const written = []

for (const size of [16, 24, 32, 48, 64, 128, 256, 512]) {
  writeFileSync(join(iconsDir, `${size}x${size}.png`), scaled(size))
  written.push(`${size}x${size}.png`)
}
// Linux 安装包图标（electron-builder 按尺寸目录取用）
for (const size of [48, 64, 128, 256, 512]) {
  writeFileSync(join(iconsDir, 'linux', `${size}x${size}.png`), scaled(size))
  written.push(`linux/${size}x${size}.png`)
}
// Android 传统 mipmap 图标
for (const size of [48, 72, 96, 144, 192]) {
  writeFileSync(join(iconsDir, 'android', `ic_launcher_${size}.png`), scaled(size))
  written.push(`android/ic_launcher_${size}.png`)
}
// 托盘小图
writeFileSync(join(iconsDir, 'tray.png'), scaled(32))
written.push('tray.png')

// ICNS：ic07=128 / ic08=256 / ic09=512（512 直接嵌入原始文件字节）
function buildIcns(entries) {
  const chunks = entries.map((e) => {
    const head = Buffer.alloc(8)
    head.write(e.type, 0, 'ascii')
    head.writeUInt32BE(e.png.length + 8, 4)
    return Buffer.concat([head, e.png])
  })
  const total = chunks.reduce((a, c) => a + c.length, 0) + 8
  const sig = Buffer.alloc(8)
  sig.write('icns', 0, 'ascii')
  sig.writeUInt32BE(total, 4)
  return Buffer.concat([sig, ...chunks])
}

writeFileSync(
  join(iconsDir, 'icon.icns'),
  buildIcns([
    { type: 'ic07', png: scaled(128) },
    { type: 'ic08', png: scaled(256) },
    { type: 'ic09', png: readFileSync(sourcePngPath) }
  ])
)
written.push('icon.icns')

console.log(`[gen-icons] 来源: ${source}；写入 ${written.length} 个文件 → ${iconsDir}`)
