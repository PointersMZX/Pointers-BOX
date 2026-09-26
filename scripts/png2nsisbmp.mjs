// 临时工具：PNG → 经典 24 位 BMP（40 字节 V1 头），供 NSIS MUI 图片使用
// 用法：node scripts/png2nsisbmp.mjs <src.png> <out.bmp>
import { readFileSync, writeFileSync } from 'node:fs'
import { decodePng } from './iconlib.mjs'

const [, , src, out] = process.argv
if (!src || !out) {
  console.error('用法: node scripts/png2nsisbmp.mjs <src.png> <out.bmp>')
  process.exit(1)
}

const d = decodePng(readFileSync(src))
const { width: w, height: h, rgba } = d

// 行底对齐 4 字节
const rowBytes = w * 3
const pad = (4 - (rowBytes % 4)) % 4
const rowPadded = rowBytes + pad
const pixelData = Buffer.alloc((h * rowPadded))

// BMP 行序自下而上；24 位 BGR
for (let y = 0; y < h; y++) {
  const dst = (h - 1 - y) * rowPadded
  for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4
    pixelData[dst + x * 3 + 0] = rgba[i + 2] // B
    pixelData[dst + x * 3 + 1] = rgba[i + 1] // G
    pixelData[dst + x * 3 + 2] = rgba[i + 0] // R
  }
  for (let p = 0; p < pad; p++) pixelData[dst + rowBytes + p] = 0
}

const fileSize = 14 + 40 + pixelData.length
const buf = Buffer.alloc(fileSize)
// BITMAPFILEHEADER（14 字节）
// 0-1 'BM' | 2-5 bfSize | 6-7 reserved1 | 8-9 reserved2 | 10-13 offbits
buf.write('BM', 0, 'ascii')
buf.writeUInt32LE(fileSize, 2)
buf.writeUInt16LE(0, 6)
buf.writeUInt16LE(0, 8)
buf.writeUInt32LE(54, 10) // 数据偏移
// BITMAPINFOHEADER（40 字节，V1 经典头——NSIS 唯一可靠支持的格式）
buf.writeUInt32LE(40, 14)
buf.writeInt32LE(w, 18)
buf.writeInt32LE(h, 22)
buf.writeUInt16LE(1, 26)
buf.writeUInt16LE(24, 28)
buf.writeUInt32LE(0, 30) // BI_RGB（comp 必须是 0；写成 1 会被 makensis 当 RLE 解码失败）
buf.writeUInt32LE(pixelData.length, 34)
// 其余（xppm / 调色板）保持 0
pixelData.copy(buf, 54)
writeFileSync(out, buf)
console.log(`${w}x${h} 24-bit 经典 BMP → ${out}（${fileSize} 字节）`)
