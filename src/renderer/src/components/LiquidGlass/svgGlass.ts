/// <reference lib="dom" />
// v2.6.0 内容卡液态玻璃折射层（SVG 位移滤镜）
// 原理（移植自 shuding/liquid-glass，MIT）：按元素尺寸用 Canvas2D 预计算一张位移贴图
// （圆角矩形 SDF 的边缘折射场，编码进 R/G 通道），经 feImage + feDisplacementMap 挂到
// 元素的 backdrop-filter 上——扭曲的是元素背后的真实页面背景（WebGL 折射做不到的：
// 它只能折射栅格化快照）。
// 分工：本模块接管内容卡（.pbox-glass）；侧栏/底栏仍归 WebGL 折射（带 7 色色散）。
// 兼容性：backdrop-filter: url(#svg) 仅 Chromium 支持（Electron/Android WebView/ArkWeb
// 都是 Chromium 内核）；不支持时本模块不启用，元素回落 :root 的 CSS 磨砂配方，降级链不受影响。
// 零依赖；DOM 操作全部收敛在管理器内，纯函数可在 node 测试环境直接跑。

/** 折射参数（来自主题材质档位 SurfaceMaterial.refraction / refractionEdge） */
export interface RefractionParams {
  /** 折射强度倍率（作用于 feDisplacementMap scale；0 = 关闭） */
  ref: number
  /** 折射圈厚度倍率（SDF 边缘阈值缩放，越大边缘环越宽） */
  edge: number
}

/** 材质磨砂尾串参数（拼在 url(#filter) 后面；与 SurfaceMaterial 同源） */
export interface BackdropTail {
  blur: number
  saturate: number
  brightness: number
}

/** 与参考实现逐行同源的两个纯函数（先导出供单测） */
export function smoothStep(a: number, b: number, t: number): number {
  const x = Math.max(0, Math.min(1, (t - a) / (b - a)))
  return x * x * (3 - 2 * x)
}

export function roundedRectSDF(x: number, y: number, w: number, h: number, r: number): number {
  const qx = Math.abs(x) - w + r
  const qy = Math.abs(y) - h + r
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) - r
}

/** 果冻回弹曲线（参考实现 springEase；t ∈ [0,1]，带一次过冲） */
export function springEase(t: number): number {
  return 1 - Math.exp(-5 * t) * Math.cos(9 * t)
}

export interface DispMap {
  width: number
  height: number
  /** RGBA：R = x 位移、G = y 位移（归一化 0..255，0.5 = 零位移） */
  data: Uint8ClampedArray
  /** 最大位移（px；feDisplacementMap 的 scale 基准） */
  maxScale: number
}

/**
 * 纯函数：计算位移贴图。
 * 归一化坐标（同参考实现）：半宽 0.3 / 半高 0.2 / 圆角 0.6，边缘阈值 0.15/edge。
 * 边缘环向中心收缩采样（透镜压缩），中心区原样采样（不折射）。
 */
export function computeDisplacementMap(w: number, h: number, edge: number): DispMap {
  const width = Math.max(2, Math.floor(w))
  const height = Math.max(2, Math.floor(h))
  const data = new Uint8ClampedArray(width * height * 4)
  const raw: number[] = []
  let maxScale = 0
  for (let i = 0; i < data.length; i += 4) {
    const x = (i / 4) % width
    const y = Math.floor(i / 4 / width)
    const ix = x / width - 0.5
    const iy = y / height - 0.5
    const d = roundedRectSDF(ix, iy, 0.3, 0.2, 0.6)
    const disp = smoothStep(0.8, 0, d - 0.15 / Math.max(edge, 0.01))
    const s = smoothStep(0, 1, disp)
    const px = (ix * s + 0.5) * width
    const py = (iy * s + 0.5) * height
    const dx = px - x
    const dy = py - y
    maxScale = Math.max(maxScale, Math.abs(dx), Math.abs(dy))
    raw.push(dx, dy)
  }
  maxScale *= 0.5
  for (let i = 0, r = 0; i < data.length; i += 4, r += 2) {
    data[i] = (raw[r]! / maxScale + 0.5) * 255
    data[i + 1] = (raw[r + 1]! / maxScale + 0.5) * 255
    data[i + 2] = 0
    data[i + 3] = 255
  }
  return { width, height, data, maxScale }
}

/** 元素上 backdrop-filter 变量的完整值（url 滤镜打头 + 材质磨砂尾串） */
export function buildBackdropValue(filterId: string, tail: BackdropTail): string {
  return `url(#${filterId}) blur(${tail.blur}px) saturate(${tail.saturate}%) brightness(${tail.brightness})`
}

/** 运行环境检测：backdrop-filter 引用 SVG 滤镜仅 Chromium 支持 */
export function canUseSvgFilter(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : ''
  const chromium = /Chrome\/\d+/.test(ua) || /Chromium\//.test(ua)
  return chromium && typeof ResizeObserver !== 'undefined'
}

interface GlassEntry {
  el: HTMLElement
  svg: SVGSVGElement
  feDisp: SVGFEDisplacementMapElement
  /** 贴图最大位移 px（scale 基准；baseScale = maxScale * ref） */
  maxScale: number
  ro: ResizeObserver
  resizeTimer: number | null
  pressRAF: number | null
  onDown: (e: PointerEvent) => void
  onUp: (e: PointerEvent) => void
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const XLINK_NS = 'http://www.w3.org/1999/xlink'
/** 贴图最长边上限（大卡降采样，feImage preserveAspectRatio=none 拉回，位移场平滑无损观感） */
const MAP_MAX_SIDE = 320
/** 按压加厚倍率（指针按住时边缘折射环临时变厚） */
const PRESS_THICKEN = 1.6

/**
 * 内容卡折射管理器（单例）：
 * - MutationObserver 扫新增 .pbox-glass；ResizeObserver 防抖重建贴图
 * - 每元素一个独立 SVG filter，inline 写 --pbox-g-backdrop（覆盖 :root 配方，
 *   移除后自动回落 → 玻璃关/不支持时的降级链零改动）
 * - 按压加厚：只改 feDisplacementMap scale 属性（不重建贴图），果冻回弹
 */
class SvgGlassManager {
  private entries = new Map<HTMLElement, GlassEntry>()
  private mo: MutationObserver | null = null
  private params: RefractionParams = { ref: 1, edge: 1 }
  private tail: BackdropTail = { blur: 18, saturate: 150, brightness: 1.07 }
  private scanTimer: number | null = null
  private uid = 0
  private running = false

  start(params: RefractionParams, tail: BackdropTail): void {
    if (!canUseSvgFilter()) return
    const edgeChanged = this.running && this.params.edge !== params.edge
    const refChanged = this.running && this.params.ref !== params.ref
    this.params = params
    this.tail = tail
    if (!this.running) {
      this.running = true
      this.mo = new MutationObserver(() => this.scheduleScan())
      this.mo.observe(document.body, { childList: true, subtree: true })
    }
    this.scheduleScan()
    // 厚度变化影响贴图阈值 → 全量重建；强度变化只需重算 scale；尾串变化只改变量
    if (edgeChanged) {
      this.entries.forEach((e) => this.rebuild(e))
    } else if (refChanged) {
      this.entries.forEach((e) => e.feDisp.setAttribute('scale', String(e.maxScale * params.ref)))
    }
  }

  stop(): void {
    if (this.mo) {
      this.mo.disconnect()
      this.mo = null
    }
    if (this.scanTimer !== null) {
      clearTimeout(this.scanTimer)
      this.scanTimer = null
    }
    Array.from(this.entries.keys()).forEach((el) => this.detach(el))
    this.running = false
  }

  private scheduleScan(): void {
    if (this.scanTimer !== null) return
    this.scanTimer = window.setTimeout(() => {
      this.scanTimer = null
      this.scan()
    }, 120)
  }

  private scan(): void {
    if (!this.running) return
    document.querySelectorAll<HTMLElement>('.pbox-glass').forEach((el) => {
      if (this.entries.has(el)) return
      // 藏起来的（display:none / 尺寸塌缩）暂不接管，等显示后 resize/重扫触发
      if (el.offsetWidth < 24 || el.offsetHeight < 24) return
      this.attach(el)
    })
    // 已离屏的元素清掉（防泄漏）
    this.entries.forEach((e, el) => {
      if (!el.isConnected) this.detach(el)
    })
  }

  private attach(el: HTMLElement): void {
    const uid = ++this.uid
    const fid = `pbox-lg-${uid}`
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('width', '0')
    svg.setAttribute('height', '0')
    svg.setAttribute('aria-hidden', 'true')
    svg.style.cssText = 'position:fixed;top:0;left:0;pointer-events:none;'
    const filter = document.createElementNS(SVG_NS, 'filter')
    filter.setAttribute('id', fid)
    filter.setAttribute('filterUnits', 'userSpaceOnUse')
    filter.setAttribute('x', '0')
    filter.setAttribute('y', '0')
    filter.setAttribute('colorInterpolationFilters', 'sRGB')
    const feImage = document.createElementNS(SVG_NS, 'feImage')
    feImage.setAttribute('id', `${fid}_map`)
    feImage.setAttribute('preserveAspectRatio', 'none')
    const feDisp = document.createElementNS(SVG_NS, 'feDisplacementMap')
    feDisp.setAttribute('in', 'SourceGraphic')
    feDisp.setAttribute('in2', `${fid}_map`)
    feDisp.setAttribute('xChannelSelector', 'R')
    feDisp.setAttribute('yChannelSelector', 'G')
    filter.appendChild(feImage)
    filter.appendChild(feDisp)
    svg.appendChild(filter)
    document.body.appendChild(svg)

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (ctx === null) {
      svg.remove()
      return
    }

    const entry: GlassEntry = {
      el,
      svg,
      feDisp,
      maxScale: 0,
      ro: new ResizeObserver(() => this.scheduleResize(entry)),
      resizeTimer: null,
      pressRAF: null,
      onDown: () => {},
      onUp: () => {}
    }
    this.entries.set(el, entry)
    entry.ro.observe(el)

    this.rebuildInto(entry, canvas, ctx, feImage)
    this.applyVars(entry)
    this.bindPress(entry)
  }

  private detach(el: HTMLElement): void {
    const entry = this.entries.get(el)
    if (!entry) return
    this.entries.delete(el)
    entry.ro.disconnect()
    if (entry.resizeTimer !== null) clearTimeout(entry.resizeTimer)
    if (entry.pressRAF !== null) cancelAnimationFrame(entry.pressRAF)
    entry.svg.remove()
    el.removeEventListener('pointerdown', entry.onDown)
    el.removeEventListener('pointerup', entry.onUp)
    el.removeEventListener('pointerleave', entry.onUp)
    el.style.removeProperty('--pbox-g-backdrop')
  }

  private scheduleResize(entry: GlassEntry): void {
    if (entry.resizeTimer !== null) return
    entry.resizeTimer = window.setTimeout(() => {
      entry.resizeTimer = null
      this.rebuild(entry)
    }, 200)
  }

  private rebuild(entry: GlassEntry): void {
    if (!this.entries.has(entry.el)) return
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (ctx === null) return
    const feImage = entry.svg.querySelector('feImage') as SVGFEImageElement | null
    if (feImage === null) return
    this.rebuildInto(entry, canvas, ctx, feImage)
    this.applyVars(entry)
  }

  /** 生成贴图并写入 feImage/scale（位移计算与参考实现逐行同源） */
  private rebuildInto(
    entry: GlassEntry,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    feImage: SVGFEImageElement
  ): void {
    const el = entry.el
    const w = Math.max(2, el.offsetWidth)
    const h = Math.max(2, el.offsetHeight)
    // 贴图降采样（最长边 ≤ MAP_MAX_SIDE），feImage 拉回实际尺寸
    const shrink = Math.min(1, MAP_MAX_SIDE / Math.max(w, h))
    const mw = Math.max(2, Math.round(w * shrink))
    const mh = Math.max(2, Math.round(h * shrink))
    const map = computeDisplacementMap(mw, mh, this.params.edge)
    canvas.width = mw
    canvas.height = mh
    ctx.putImageData(new ImageData(new Uint8ClampedArray(map.data), mw, mh), 0, 0)
    feImage.setAttribute('width', String(w))
    feImage.setAttribute('height', String(h))
    feImage.setAttributeNS(XLINK_NS, 'href', canvas.toDataURL())
    entry.maxScale = map.maxScale
    entry.feDisp.setAttribute('scale', String(entry.maxScale * this.params.ref))
  }

  /** inline 覆盖 :root 的 backdrop 配方：url 滤镜打头 + 材质磨砂尾串 */
  private applyVars(entry: GlassEntry): void {
    const fid = entry.svg.querySelector('filter')!.id
    entry.el.style.setProperty('--pbox-g-backdrop', buildBackdropValue(fid, this.tail))
  }

  /** 按压加厚 + 果冻回弹（只动 scale 属性；reduced-motion 直接跳变） */
  private bindPress(entry: GlassEntry): void {
    const el = entry.el
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const base = (): number => entry.maxScale * this.params.ref
    const down = (): void => {
      if (entry.pressRAF !== null) cancelAnimationFrame(entry.pressRAF)
      const from = Number(entry.feDisp.getAttribute('scale') || base())
      if (reduced) {
        entry.feDisp.setAttribute('scale', String(base() * PRESS_THICKEN))
        return
      }
      this.animateScale(entry, from, base() * PRESS_THICKEN, 110, (t) => t)
    }
    const up = (): void => {
      if (entry.pressRAF !== null) cancelAnimationFrame(entry.pressRAF)
      const from = Number(entry.feDisp.getAttribute('scale') || base())
      if (reduced) {
        entry.feDisp.setAttribute('scale', String(base()))
        return
      }
      this.animateScale(entry, from, base(), 460, springEase)
    }
    entry.onDown = down
    entry.onUp = up
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointerleave', up)
  }

  private animateScale(
    entry: GlassEntry,
    from: number,
    to: number,
    durMs: number,
    ease: (t: number) => number
  ): void {
    const t0 = performance.now()
    const tick = (now: number): void => {
      const t = Math.min(1, (now - t0) / durMs)
      const v = from + (to - from) * ease(t)
      entry.feDisp.setAttribute('scale', String(v))
      if (t < 1) {
        entry.pressRAF = requestAnimationFrame(tick)
      } else {
        entry.pressRAF = null
      }
    }
    entry.pressRAF = requestAnimationFrame(tick)
  }
}

const manager = new SvgGlassManager()

/** 总开关：玻璃开 + 主题折射档位 > 0 时启用；关闭时清场回落 CSS 磨砂 */
export function setSvgGlass(
  enabled: boolean,
  params: RefractionParams,
  tail: BackdropTail
): void {
  if (enabled && params.ref > 0) {
    manager.start(params, tail)
  } else {
    manager.stop()
  }
}
