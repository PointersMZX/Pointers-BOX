// 从用户提供的 app-icon.png（512x512）派生全部平台图标。
// 不覆盖用户提供的 app.ico 与 app-icon.png；PNG 不可解码时退回程序绘制图标。
// v2.6.0：恢复 linux/ 目录与 icon.icns 派生（macOS/Linux 打包需要）
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodePng, encodePng, resizeBilinear, drawIcon } from './iconlib.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const iconsDir = join(root, 'resources', 'icons')

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
// Android 启动图标
for (const size of [48, 72, 96, 144, 192]) {
  writeFileSync(join(iconsDir, 'android', `ic_launcher_${size}.png`), scaled(size))
  written.push(`android/ic_launcher_${size}.png`)
}
// 托盘小图
writeFileSync(join(iconsDir, 'tray.png'), scaled(32))
written.push('tray.png')

// Linux 图标目录（electron-builder linux.icon 指向该目录，按尺寸挑选）
mkdirSync(join(iconsDir, 'linux'), { recursive: true })
for (const size of [16, 24, 32, 48, 64, 128, 256, 512]) {
  writeFileSync(join(iconsDir, 'linux', `${size}x${size}.png`), scaled(size))
  written.push(`linux/${size}x${size}.png`)
}

// macOS icns：文件头（'icns' + 总长）+ PNG 块（ic07=128 / ic08=256 / ic09=512 / ic10=1024）。
// 现代系统（10.9+）接受 PNG 编码块；ic10 由 512 双线性放大。
function icnsEncode(entries) {
  const blocks = entries.map(([type, png]) => {
    const head = Buffer.alloc(8)
    head.write(type, 0, 'ascii')
    head.writeUInt32BE(png.length + 8, 4)
    return Buffer.concat([head, png])
  })
  const total = 8 + blocks.reduce((n, b) => n + b.length, 0)
  const header = Buffer.alloc(8)
  header.write('icns', 0, 'ascii')
  header.writeUInt32BE(total, 4)
  return Buffer.concat([header, ...blocks])
}

const icnsEntries = [
  ['ic07', scaled(128)],
  ['ic08', scaled(256)],
  ['ic09', scaled(512)],
  ['ic10', scaled(1024)]
]
writeFileSync(join(iconsDir, 'icon.icns'), icnsEncode(icnsEntries))
written.push('icon.icns')

console.log(`[gen-icons] 来源: ${source}；写入 ${written.length} 个文件 → ${iconsDir}`)
