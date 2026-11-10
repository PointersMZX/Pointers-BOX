import {
  buildBackdropValue,
  canUseSvgFilter,
  computeDisplacementMap,
  roundedRectSDF,
  smoothStep,
  springEase
} from '../src/renderer/src/components/LiquidGlass/svgGlass'
import { getSurfaceMaterial } from '../src/renderer/src/theme/buildTheme'

describe('svgGlass 纯函数（v2.6.0 内容卡折射层）', () => {
  it('smoothStep 边界与单调性', () => {
    expect(smoothStep(0, 1, -1)).toBe(0)
    expect(smoothStep(0, 1, 0)).toBe(0)
    expect(smoothStep(0, 1, 1)).toBe(1)
    expect(smoothStep(0, 1, 2)).toBe(1)
    // 参考实现的反向 smoothStep(0.8, 0, t)：深内部 = 1，远边缘 = 0
    expect(smoothStep(0.8, 0, -0.1)).toBe(1)
    expect(smoothStep(0.8, 0, 1)).toBe(0)
    const a = smoothStep(0, 1, 0.3)
    const b = smoothStep(0, 1, 0.7)
    expect(a).toBeGreaterThan(0)
    expect(b).toBeGreaterThan(a)
    expect(b).toBeLessThan(1)
  })

  it('roundedRectSDF：内部为负、外部为正、边缘为 0', () => {
    expect(roundedRectSDF(0, 0, 0.3, 0.2, 0.6)).toBeLessThan(0) // 中心
    expect(roundedRectSDF(0.9, 0.9, 0.3, 0.2, 0.6)).toBeGreaterThan(0) // 远外部
    // 沿 x 从中心到外部单调增大（半径 0.6 大于半高 0.2，参考实现即如此——
    // 折射环由阈值控制而非精确几何边界）
    let prev = roundedRectSDF(0, 0, 0.3, 0.2, 0.6)
    for (let x = 0.1; x <= 0.9; x += 0.1) {
      const d = roundedRectSDF(x, 0, 0.3, 0.2, 0.6)
      expect(d).toBeGreaterThan(prev)
      prev = d
    }
  })

  it('computeDisplacementMap：中心零位移、边缘向中心收缩、编码合法', () => {
    const w = 100
    const h = 60
    const map = computeDisplacementMap(w, h, 1)
    expect(map.width).toBe(w)
    expect(map.height).toBe(h)
    expect(map.data.length).toBe(w * h * 4)
    expect(map.maxScale).toBeGreaterThan(0)

    const idx = (x: number, y: number): number => (y * w + x) * 4
    // 中心：0.5 归一化零位移
    expect(Math.abs(map.data[idx(50, 30)]! - 127.5)).toBeLessThan(2)
    expect(Math.abs(map.data[idx(50, 30) + 1]! - 127.5)).toBeLessThan(2)
    // 左边缘：x 位移指向中心（正位移）→ R > 0.5*255
    expect(map.data[idx(1, 30)]!).toBeGreaterThan(128)
    // 顶边缘：y 位移指向中心（正位移）→ G > 0.5*255
    expect(map.data[idx(50, 1) + 1]!).toBeGreaterThan(128)
    // alpha 全 255（feImage 不透明贴图）
    expect(map.data[idx(50, 30) + 3]!).toBe(255)
  })

  it('computeDisplacementMap：edge 增大 → 折射圈变宽 → maxScale 变大', () => {
    const thin = computeDisplacementMap(120, 80, 0.6)
    const thick = computeDisplacementMap(120, 80, 2.0)
    expect(thick.maxScale).toBeGreaterThanOrEqual(thin.maxScale)
  })

  it('springEase：起点 0、终点 1、带过冲', () => {
    expect(springEase(0)).toBeCloseTo(0, 5)
    // 参考曲线 t=1 ≈ 1.006（指数衰减项未归一），收在 1 附近
    expect(Math.abs(springEase(1) - 1)).toBeLessThan(0.01)
    // 过冲：中途某点 > 1
    let max = 0
    for (let i = 0; i <= 100; i++) max = Math.max(max, springEase(i / 100))
    expect(max).toBeGreaterThan(1)
  })

  it('buildBackdropValue：url 滤镜打头 + 磨砂尾串', () => {
    expect(buildBackdropValue('pbox-lg-3', { blur: 18, saturate: 150, brightness: 1.07 })).toBe(
      'url(#pbox-lg-3) blur(18px) saturate(150%) brightness(1.07)'
    )
  })

  it('canUseSvgFilter：node 环境返回 false（无 window/document）', () => {
    expect(canUseSvgFilter()).toBe(false)
  })
})

describe('getSurfaceMaterial 材质出口（svgGlass 与 buildTheme 同源）', () => {
  it('玻璃开：折射档位来自主题材质', () => {
    expect(getSurfaceMaterial('zj', true).refraction).toBeGreaterThan(0)
    expect(getSurfaceMaterial('black', true).refraction).toBeGreaterThan(0)
    expect(getSurfaceMaterial('white', true).refractionEdge).toBeGreaterThan(0)
  })

  it('玻璃关：折射归零（svgGlass 据此不启用）', () => {
    for (const key of ['zj', 'custom', 'black', 'white'] as const) {
      expect(getSurfaceMaterial(key, false).refraction).toBe(0)
    }
  })
})
