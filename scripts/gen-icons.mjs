// 从用户提供的 app-icon.png（512x512）派生全部平台图标。
// 不覆盖用户提供的 app.ico 与 app-icon.png；PNG 不可解码时退回程序绘制图标。
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodePng, encodePng, resizeBilinear, drawIcon } from './iconlib.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const iconsDir = join(root, 'resources', 'icons')

// v2.2.0：仅 Windows + Android 双端，不再生成 linux/ 子目录与 icon.icns
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
// 托盘小图
for (const size of [48, 72, 96, 144, 192]) {
  writeFileSync(join(iconsDir, 'android', `ic_launcher_${size}.png`), scaled(size))
  written.push(`android/ic_launcher_${size}.png`)
}
// 托盘小图
writeFileSync(join(iconsDir, 'tray.png'), scaled(32))
written.push('tray.png')

console.log(`[gen-icons] 来源: ${source}；写入 ${written.length} 个文件 → ${iconsDir}`)
