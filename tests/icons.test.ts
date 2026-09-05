import { deflateSync } from 'node:zlib'
import { PNG_SIGNATURE, chunk, encodePng, makePng, decodePng, resizeBilinear } from '../scripts/iconlib.mjs'

describe('iconlib：PNG 编码/解码', () => {
  it('RGBA 编码 → 解码 往返一致', () => {
    const w = 3
    const h = 2
    const rgba = Buffer.alloc(w * h * 4)
    for (let i = 0; i < w * h * 4; i++) rgba[i] = (i * 37) % 256
    const png = encodePng(w, h, rgba)
    const decoded = decodePng(png)
    expect(decoded.width).toBe(w)
    expect(decoded.height).toBe(h)
    expect(Buffer.compare(decoded.rgba, rgba)).toBe(0)
  })

  it('解码 RGB(colorType 2) PNG：alpha 补 255', () => {
    // 2 行 × 1 像素 RGB，filter 0
    const raw = Buffer.from([0, 255, 0, 0, 0, 0, 0, 255])
    const png = makePng(1, 2, 2, raw)
    const decoded = decodePng(png)
    expect([...decoded.rgba.subarray(0, 4)]).toEqual([255, 0, 0, 255])
    expect([...decoded.rgba.subarray(4, 8)]).toEqual([0, 0, 255, 255])
  })

  it('解码覆盖全部 5 种行过滤器(0-4)的 RGB PNG', () => {
    // 5 行 × 2 像素 RGB，行过滤器依次 0,1(sub),2(up),3(average),4(paeth)
    const raw = Buffer.from([
      // filter 0
      0, 1, 2, 3, 4, 5, 6,
      // filter 1 (sub)：第二像素存与第一像素的差
      1, 10, 20, 30, 3, 6, 9,
      // filter 2 (up)：与上一行差
      2, 2, 4, 6, 2, 4, 6,
      // filter 3 (average)：与本行左像素、上一行像素的平均值之差
      3, 10, 20, 30, 4, 7, 11,
      // filter 4 (paeth)：首像素无左/左上邻居（a=c=0，预测取上方像素）
      4, 2, 4, 6, 2, 4, 6
    ])
    const png = makePng(2, 5, 2, raw)
    const d = decodePng(png)
    const expectPixel = (idx: number, r: number, g: number, b: number): void => {
      const o = idx * 4
      expect([d.rgba[o], d.rgba[o + 1], d.rgba[o + 2], d.rgba[o + 3]]).toEqual([r, g, b, 255])
    }
    expectPixel(0, 1, 2, 3)
    expectPixel(1, 4, 5, 6)
    expectPixel(2, 10, 20, 30)
    expectPixel(3, 13, 26, 39)
    expectPixel(4, 12, 24, 36)
    expectPixel(5, 15, 30, 45)
    expectPixel(6, 16, 32, 48)
    expectPixel(7, 19, 38, 57)
    expectPixel(8, 18, 36, 54)
    expectPixel(9, 21, 42, 63)
  })

  it('坏数据被拒绝：非 PNG / 不支持位深', () => {
    expect(() => decodePng(Buffer.from('not a png'))).toThrow()
    const raw = Buffer.from([0, 1])
    // 位深 16
    const ihdr = Buffer.alloc(13)
    ihdr.writeUInt32BE(1, 0)
    ihdr.writeUInt32BE(1, 4)
    ihdr[8] = 16
    ihdr[9] = 2
    const bad = Buffer.concat([
      PNG_SIGNATURE,
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0))
    ])
    expect(() => decodePng(bad)).toThrow(/位深/)
  })
})

describe('iconlib：双线性缩放', () => {
  it('角点像素保持不变', () => {
    const w = 2
    const h = 2
    const rgba = Buffer.from([
      10, 0, 0, 255, 200, 0, 0, 255, 0, 10, 0, 255, 0, 0, 200, 255
    ])
    const up = resizeBilinear({ width: w, height: h, rgba }, 4, 4)
    expect(up.width).toBe(4)
    const at = (x: number, y: number): number[] => {
      const o = (y * 4 + x) * 4
      return [up.rgba[o]!, up.rgba[o + 1]!, up.rgba[o + 2]!]
    }
    expect(at(0, 0)).toEqual([10, 0, 0])
    expect(at(3, 0)).toEqual([200, 0, 0])
    expect(at(0, 3)).toEqual([0, 10, 0])
    expect(at(3, 3)).toEqual([0, 0, 200])
  })

  it('等尺寸缩放返回相同内容', () => {
    const rgba = Buffer.alloc(16 * 16 * 4, 128)
    const same = resizeBilinear({ width: 16, height: 16, rgba }, 16, 16)
    expect(Buffer.compare(same.rgba, rgba)).toBe(0)
  })
})
