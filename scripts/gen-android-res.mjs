// 生成 android/app/src/main/res 下的启动图标与开屏图（v2.3.0 图标链路）：
// - mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher{,_round,_foreground}.png
//   直接取 resources/icons/android/ic_launcher_{48,72,96,144,192}.png（gen-icons 产物，同一图源）
// - drawable*/splash.png（11 个尺寸变体）：紫→黑渐变底 + 居中品牌图标（v2.3.0 紫金黑视觉）
// 用法：node scripts/gen-icons.mjs && node scripts/gen-android-res.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { decodePng, encodePng, resizeBilinear } from './iconlib.mjs'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const iconsDir = join(root, 'resources', 'icons')
const resDir = join(root, 'android', 'app', 'src', 'main', 'res')

// ── mipmap 同步 ──────────────────────────────────────────────
// 密度 → gen-icons 产物尺寸
const MIPMAP_SIZES = [
  { density: 'mdpi', file: 'ic_launcher_48.png' },
  { density: 'hdpi', file: 'ic_launcher_72.png' },
  { density: 'xhdpi', file: 'ic_launcher_96.png' },
  { density: 'xxhdpi', file: 'ic_launcher_144.png' },
  { density: 'xxxhdpi', file: 'ic_launcher_192.png' }
]

for (const { density, file } of MIPMAP_SIZES) {
  const buf = readFileSync(join(iconsDir, 'android', file))
  const dir = join(resDir, `mipmap-${density}`)
  mkdirSync(dir, { recursive: true })
  for (const name of ['ic_launcher', 'ic_launcher_round', 'ic_launcher_foreground']) {
    writeFileSync(join(dir, `${name}.png`), buf)
  }
  console.log(`[gen-android-res] mipmap-${density}: 3 个文件 ← ${file}`)
}

// ── splash 生成 ──────────────────────────────────────────────
// 尺寸与既有 res 布局一致（base + 横竖屏各密度）
const SPLASH_VARIANTS = [
  { dir: 'drawable', w: 480, h: 320 },
  { dir: 'drawable-land-mdpi', w: 480, h: 320 },
  { dir: 'drawable-land-hdpi', w: 800, h: 480 },
  { dir: 'drawable-land-xhdpi', w: 1280, h: 720 },
  { dir: 'drawable-land-xxhdpi', w: 1600, h: 960 },
  { dir: 'drawable-land-xxxhdpi', w: 1920, h: 1280 },
  { dir: 'drawable-port-mdpi', w: 320, h: 480 },
  { dir: 'drawable-port-hdpi', w: 480, h: 800 },
  { dir: 'drawable-port-xhdpi', w: 720, h: 1280 },
  { dir: 'drawable-port-xxhdpi', w: 960, h: 1600 },
  { dir: 'drawable-port-xxxhdpi', w: 1280, h: 1920 }
]

// 紫→黑对角渐变 + 图标居中（短边 42%），图标外留呼吸边
const BG_TOP = [34, 18, 64] // 深紫
const BG_BOTTOM = [6, 4, 14] // 近黑

function renderSplash(w, h) {
  const src = decodePng(readFileSync(join(iconsDir, 'app-icon.png')))
  const iconSize = Math.round(Math.min(w, h) * 0.42)
  const icon = resizeBilinear(src, iconSize, iconSize)
  const ix = Math.round((w - iconSize) / 2)
  const iy = Math.round((h - iconSize) / 2)

  const rgba = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // 对角渐变：左上深紫 → 右下近黑（归一化坐标 t∈[0,1]）
      const t = (x / (w - 1) + y / (h - 1)) / 2
      let r = BG_TOP[0] + (BG_BOTTOM[0] - BG_TOP[0]) * t
      let g = BG_TOP[1] + (BG_BOTTOM[1] - BG_TOP[1]) * t
      let b = BG_TOP[2] + (BG_BOTTOM[2] - BG_TOP[2]) * t
      const si = ((y - iy) * iconSize + (x - ix)) * 4
      if (y >= iy && y < iy + iconSize && x >= ix && x < ix + iconSize) {
        const a = icon.rgba[si + 3] / 255
        if (a > 0) {
          r = r * (1 - a) + icon.rgba[si] * a
          g = g * (1 - a) + icon.rgba[si + 1] * a
          b = b * (1 - a) + icon.rgba[si + 2] * a
        }
      }
      const i = (y * w + x) * 4
      rgba[i] = Math.round(r)
      rgba[i + 1] = Math.round(g)
      rgba[i + 2] = Math.round(b)
      rgba[i + 3] = 255
    }
  }
  return encodePng(w, h, rgba)
}

for (const v of SPLASH_VARIANTS) {
  const buf = renderSplash(v.w, v.h)
  mkdirSync(join(resDir, v.dir), { recursive: true })
  writeFileSync(join(resDir, v.dir, 'splash.png'), buf)
}
console.log(`[gen-android-res] splash: ${SPLASH_VARIANTS.length} 个变体已生成`)
