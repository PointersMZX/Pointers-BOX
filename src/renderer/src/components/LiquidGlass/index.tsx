// Pointers-BOX · LiquidGlass WebGL 叠层组件（v2.3.0 移植自 XingyuMusic-desktop）
// canvas 固定定位叠在 chrome 面板（侧栏/底栏）上：SDF 折射 + 7 色色散 + 边缘流光 + 指针高光。
// 折射源 = body 背景堆叠（主题 glassBg 渐变）栅格化后的磨砂副本。
// 零外部依赖（纯 WebGL1 + 2D canvas）；WebGL 不可用时 canvas 隐藏，CSS 玻璃（pbox-blur-* + 光斑）原样兜底。
// 主题联动：读 CSS 变量 --liquid-glass（总开关）/ --color-glass-edge / --color-glass-tint / --color-glass-base（buildTheme 按主题注入）。
// 激活时给 documentElement 加 .pbox-liquid-active（多实例引用计数），buildTheme 的对应规则撤掉被接管面板的 CSS 磨砂。
import { useEffect, useRef } from 'react'
import { fragmentSrc, vertexSrc } from './shaders'

// 面板变体参数（沿 XingyuMusic 调优值：sidebar=轻（toolbar 参数），bar=强（player 参数））
const VARIANT_PARAMS = {
  sidebar: {
    radius: 10,
    refractionHeight: 26,
    refractionAmount: 6,
    depthEffect: 0.22,
    chromatic: 1.6,
    edgeFalloff: 2.8,
    sheen: 0.7,
    glow: 1.1,
    blur: 2
  },
  bar: {
    radius: 14,
    refractionHeight: 40,
    refractionAmount: 10,
    depthEffect: 0.3,
    chromatic: 2.2,
    edgeFalloff: 2.4,
    sheen: 0.85,
    glow: 1.4,
    blur: 2.5
  }
}

type Variant = keyof typeof VARIANT_PARAMS

interface Props {
  /** 目标面板的 CSS 选择器（组件把 canvas 精确铺到该元素矩形上） */
  target: string
  variant?: Variant
}

// ---------- 颜色解析（CSS 颜色 → [r,g,b,a] 0..1） ----------
function parseColor(str: string, fallback: [number, number, number, number] = [0, 0, 0, 0]): [number, number, number, number] {
  if (!str) return fallback
  str = str.trim()
  if (str === 'transparent' || str === 'none') return [0, 0, 0, 0]
  let m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:,\s*([\d.]+)\s*)?\)/.exec(str)
  if (m) {
    return [
      Number(m[1]) / 255,
      Number(m[2]) / 255,
      Number(m[3]) / 255,
      m[4] == null ? 1 : Number(m[4])
    ]
  }
  m = /^#([0-9a-f]{8})$/i.exec(str)
  if (m) {
    const n = parseInt(m[1] as string, 16)
    return [
      ((n >> 24) & 255) / 255,
      ((n >> 16) & 255) / 255,
      ((n >> 8) & 255) / 255,
      (n & 255) / 255
    ]
  }
  m = /^#([0-9a-f]{6})$/i.exec(str)
  if (m) {
    const n = parseInt(m[1] as string, 16)
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1]
  }
  m = /^#([0-9a-f]{3})$/i.exec(str)
  if (m) {
    const h = (m[1] ?? '') as string
    const r = parseInt((h[0] ?? '') + (h[0] ?? ''), 16) / 255
    const g = parseInt((h[1] ?? '') + (h[1] ?? ''), 16) / 255
    const b = parseInt((h[2] ?? '') + (h[2] ?? ''), 16) / 255
    return [r, g, b, 1]
  }
  return fallback
}

// 分割 CSS 多层 background 值（顶层逗号；括号内逗号不切）
function splitLayers(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

function splitStops(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of s) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === ',' && depth === 0) {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

// 画一个 radial-gradient 层：'radial-gradient(1100px 700px at 18% -10%, c1, c2)'
function paintRadial(ctx: CanvasRenderingContext2D, layer: string, W: number, H: number): void {
  let m = /radial-gradient\((.*)\)\s*$/s.exec(layer)
  if (!m) return
  const inner = m[1] as string
  // 顶层逗号：第一段 = 几何（size [at pos]），其余 = stops（原版取"最后一个逗号"会误把 stop 当位置）
  let geomEnd = -1
  let d0 = 0
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (ch === '(') d0++
    else if (ch === ')') d0--
    else if (ch === ',' && d0 === 0) {
      geomEnd = i
      break
    }
  }
  const geom = geomEnd > -1 ? inner.slice(0, geomEnd) : inner
  const stopsStr = geomEnd > -1 ? inner.slice(geomEnd + 1) : ''

  // 'at' 关键字（顶层）：其前 = size，其后 = 位置
  let sizeStr = geom
  let posStr = ''
  let atIdx = -1
  let atDepth = 0
  for (let i = 0; i < geom.length; i++) {
    const ch = geom[i]
    if (ch === '(') atDepth++
    else if (ch === ')') atDepth--
    else if (atDepth === 0 && ch === 'a' && geom.slice(i, i + 3) === 'at ') atIdx = i
  }
  if (atIdx > -1) {
    sizeStr = geom.slice(0, atIdx)
    posStr = geom.slice(atIdx + 3)
  } else if (geomEnd > -1) {
    // 无 'at'：全 px 视为 size（多余段为位置），否则整段为位置
    const parts = geom.trim().split(/\s+/).filter(Boolean)
    const allPx = parts.length > 0 && parts.every((p) => /^\d+(\.\d+)?px$/.test(p))
    if (allPx) {
      sizeStr = parts.slice(0, 2).join(' ')
      posStr = parts.slice(2).join(' ')
    } else {
      sizeStr = ''
      posStr = parts.join(' ')
    }
  }

  // 位置：前两个 token（% 或 px；center 归一化）
  let cx = W * 0.5
  let cy = H * 0.5
  const posTokens = posStr.trim().split(/\s+/).filter(Boolean)
  if (posTokens.length >= 1) {
    const tx = posTokens[0] ?? ''
    const ty = posTokens.length >= 2 ? posTokens[1] ?? '' : tx
    cx = tx === 'center' ? W / 2 : /%$/.test(tx) ? (Number(tx) / 100) * W : Number(tx)
    cy = ty === 'center' ? H / 2 : /%$/.test(ty) ? (Number(ty) / 100) * H : Number(ty)
  }
  // 尺寸：结尾 px 的数字 token
  const sizeTokens = sizeStr.split(/\s+/).filter((t) => /^\d+(\.\d+)?px$/.test(t))
  let rx = Math.hypot(Math.max(cx, W - cx), Math.max(cy, H - cy)) * 0.8
  let ry = rx
  if (sizeTokens.length >= 1) rx = Number(sizeTokens[0]) || rx
  if (sizeTokens.length >= 2) ry = Number(sizeTokens[1]) || ry
  // 防御：任何 NaN/0 都回退默认圆（避免 createRadialGradient 抛 non-finite）
  if (!Number.isFinite(cx)) cx = W / 2
  if (!Number.isFinite(cy)) cy = H / 2
  if (!Number.isFinite(rx) || rx < 1) rx = Math.max(Math.min(W, H) * 0.6, 1)
  if (!Number.isFinite(ry) || ry < 1) ry = rx

  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(1, ry / rx)
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx)
  const stops = splitStops(stopsStr)
  for (let i = 0; i < stops.length; i++) {
    const stopRaw = stops[i] ?? ''
    const sm = /^(rgba?\([^)]*\)|#[0-9a-fA-F]+|transparent)\s*([\d.]+%?)?$/.exec(stopRaw.trim())
    const offset = sm?.[2] ? Number(sm[2].replace('%', '')) / 100 : i / Math.max(stops.length - 1, 1)
    let color = sm ? sm[1] ?? stopRaw.trim() : stopRaw.trim()
    if (color === 'transparent') color = 'rgba(0,0,0,0)'
    g.addColorStop(Math.min(Math.max(offset, 0), 1), color)
  }
  ctx.fillStyle = g
  ctx.fillRect(-rx, -rx, rx * 2, rx * 2)
  ctx.restore()
}
// 画一个 linear-gradient 层：'linear-gradient(180deg, c1, c2)'
function paintLinear(ctx: CanvasRenderingContext2D, layer: string, W: number, H: number): void {
  let m = /linear-gradient\((.*)\)\s*$/s.exec(layer)
  if (!m) return
  const inner = m[1] as string
  let depth = 0
  let firstComma = -1
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === ',' && depth === 0) {
      firstComma = i
      break
    }
  }
  const head = (firstComma > -1 ? inner.slice(0, firstComma) : inner).trim()
  const stopsStr = firstComma > -1 ? inner.slice(firstComma + 1) : ''
  let angleDeg = 180
  const dirM = /to\s+(right|left|top|bottom)|(-?[\d.]+)deg/.exec(head)
  if (dirM) {
    if (dirM[1] === 'right') angleDeg = 90
    else if (dirM[1] === 'left') angleDeg = 270
    else if (dirM[1] === 'top') angleDeg = 0
    else if (dirM[2] != null) angleDeg = Number(dirM[2])
  }
  const a = (angleDeg * Math.PI) / 180
  const dx = Math.sin(a)
  const dy = -Math.cos(a)
  const len = Math.abs(W * dx) + Math.abs(H * dy) || 1
  const x0 = W / 2 - (dx * len) / 2
  const y0 = H / 2 - (dy * len) / 2
  const g = ctx.createLinearGradient(x0, y0, x0 + dx * len, y0 + dy * len)
  const stops = splitStops(stopsStr)
  for (let i = 0; i < stops.length; i++) {
    const stopRaw = stops[i] ?? ''
    const sm = /^(rgba?\([^)]*\)|#[0-9a-fA-F]+|transparent)\s*([\d.]+%?)?$/.exec(stopRaw.trim())
    const offset = sm?.[2] ? Number(sm[2].replace('%', '')) / 100 : i / Math.max(stops.length - 1, 1)
    let color = sm ? sm[1] ?? stopRaw.trim() : stopRaw.trim()
    if (color === 'transparent') color = 'rgba(0,0,0,0)'
    g.addColorStop(Math.min(Math.max(offset, 0), 1), color)
  }
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
}

// 多个 LiquidGlass 实例共用同一激活类：引用计数（StrictMode 双挂载也安全）
let domClassCount = 0
function syncDomClass(on: boolean, meVisible: boolean): void {
  if (on === meVisible) return
  domClassCount += on ? 1 : -1
  if (domClassCount < 0) domClassCount = 0
  document.documentElement.classList.toggle('pbox-liquid-active', domClassCount > 0)
}

export default function LiquidGlass({ target, variant = 'bar' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const param = VARIANT_PARAMS[variant]

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const canvas: HTMLCanvasElement = cv

    let gl: WebGLRenderingContext | null = null
    let prog: WebGLProgram | null = null
    let contentTex: WebGLTexture | null = null
    let uniforms: Record<string, WebGLUniformLocation | null> = {}
    let rafId = 0
    let themeTimer = 0
    let meVisible = false
    let lastW = 0
    let lastH = 0
    let pointerX = 0
    let pointerY = 0
    let smPointerX = 0
    let smPointerY = 0
    let smPointerA = 0
    let themeVars: { enabled: boolean; edge: [number, number, number, number]; tint: [number, number, number, number]; base: [number, number, number, number] } | null = null

    // ---------- 背景栅格化（body 背景堆叠 → 离屏 canvas；变化时才重画） ----------
    let bgCanvas: HTMLCanvasElement | null = null
    let blurCanvas: HTMLCanvasElement | null = null
    let bgSig = ''
    function rasterizeBackground(): boolean {
      const body = document.body
      if (!body) return false
      const W = (document.getElementById('root') as HTMLElement | null)?.clientWidth || window.innerWidth
      const H =
        (document.getElementById('root') as HTMLElement | null)?.clientHeight || window.innerHeight
      const cs = getComputedStyle(body)
      const sig = [W, H, cs.backgroundColor, cs.backgroundImage].join('|')
      if (sig === bgSig && bgCanvas) return false
      bgSig = sig
      if (!bgCanvas) bgCanvas = document.createElement('canvas')
      bgCanvas.width = W
      bgCanvas.height = H
      const ctx = bgCanvas.getContext('2d')
      if (!ctx) return false
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = cs.backgroundColor || 'rgba(0,0,0,0)'
      ctx.fillRect(0, 0, W, H)
      const bgImage = cs.backgroundImage || 'none'
      if (bgImage !== 'none' && !bgImage.includes('var(')) {
        for (const layer of splitLayers(bgImage)) {
          if (layer.startsWith('radial-gradient')) paintRadial(ctx, layer, W, H)
          else if (layer.startsWith('linear-gradient')) paintLinear(ctx, layer, W, H)
        }
      }
      // 磨砂（frosted）副本：折射源加轻微高斯模糊，玻璃才有"磨砂折射"的实体感
      if (!blurCanvas) blurCanvas = document.createElement('canvas')
      blurCanvas.width = W
      blurCanvas.height = H
      const bctx = blurCanvas.getContext('2d')
      if (bctx) {
        bctx.clearRect(0, 0, W, H)
        bctx.filter = `blur(${param.blur}px)`
        bctx.drawImage(bgCanvas, 0, 0)
        bctx.filter = 'none'
      }
      return true
    }

    // ---------- 主题变量（buildTheme 注入 documentElement 的 CSS 变量） ----------
    function readThemeVars(): void {
      const cs = getComputedStyle(document.documentElement)
      const glassEnable = (cs.getPropertyValue('--liquid-glass') || '').trim()
      themeVars = {
        enabled: glassEnable !== 'false',
        edge: parseColor(cs.getPropertyValue('--color-glass-edge').trim(), [0, 0, 0, 0]),
        tint: parseColor(cs.getPropertyValue('--color-glass-tint').trim(), [0, 0, 0, 0]),
        base: parseColor(cs.getPropertyValue('--color-glass-base').trim(), [0, 0, 0, 0])
      }
    }

    // ---------- WebGL ----------
    function compile(type: number, src: string): WebGLShader | null {
      if (!gl) return null
      const s = gl.createShader(type)
      if (!s) return null
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('[LiquidGlass] shader compile error:', gl.getShaderInfoLog(s))
        return null
      }
      return s
    }

    // ---------- WebGL 初始化（成功返回上下文；不可用返回 null，调用方走 CSS 兜底） ----------
    function initGL(): WebGLRenderingContext | null {
      const ctx = canvas.getContext('webgl', {
        alpha: true,
        antialias: false,
        premultipliedAlpha: false,
        depth: false,
        stencil: false
      })
      if (!ctx) return null
      gl = ctx
      const g = ctx
      const vs = compile(g.VERTEX_SHADER, vertexSrc)
      const fs = compile(g.FRAGMENT_SHADER, fragmentSrc)
      if (!vs || !fs) return null
      const p = g.createProgram()
      if (!p) return null
      g.attachShader(p, vs)
      g.attachShader(p, fs)
      g.linkProgram(p)
      if (!g.getProgramParameter(p, g.LINK_STATUS)) {
        console.error('[LiquidGlass] link error:', g.getProgramInfoLog(p))
        return null
      }
      prog = p
      g.useProgram(p)
      const buf = g.createBuffer()
      g.bindBuffer(g.ARRAY_BUFFER, buf)
      g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW)
      const loc = g.getAttribLocation(p, 'a_pos')
      g.enableVertexAttribArray(loc)
      g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0)
      for (const name of [
        'u_content',
        'u_panelSize',
        'u_panelPos',
        'u_windowSize',
        'u_radius',
        'u_refractionHeight',
        'u_refractionAmount',
        'u_depthEffect',
        'u_chromatic',
        'u_edgeFalloff',
        'u_edgeColor',
        'u_tint',
        'u_base',
        'u_glowColor',
        'u_pointer',
        'u_pointerA',
        'u_sheen',
        'u_glow',
        'u_time'
      ]) {
        uniforms[name] = g.getUniformLocation(p, name)
      }
      contentTex = g.createTexture()
      g.bindTexture(g.TEXTURE_2D, contentTex)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
      g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false)
      // 注意：initGL 在 const uni 定义之前执行（函数声明提升），此处直接查表
      g.uniform1i(uniforms['u_content'] ?? null, 0)
      g.enable(g.BLEND)
      g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA)
      return g
    }

    const g = initGL()
    if (!g) {
      canvas.style.display = 'none'
      return
    }

    // uniform 取址（noUncheckedIndexedAccess：索引访问可能 undefined）
    const uni = (n: string): WebGLUniformLocation | null => uniforms[n] ?? null

    const onPointerMove = (e: PointerEvent): void => {
      pointerX = e.clientX
      pointerY = e.clientY
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })

    function uploadContentTex(changed: boolean): void {
      const src = blurCanvas || bgCanvas
      if (!g || !src || !changed) return
      g.bindTexture(g.TEXTURE_2D, contentTex)
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, src)
    }

    function draw(): void {
      rafId = requestAnimationFrame(draw)
      if (!g || !prog) return
      const c = canvas
      const tgt = document.querySelector(target)
      const root = document.getElementById('root')
      if (!themeVars) readThemeVars()
      if (!tgt || !root || !themeVars) {
        if (c.style.display !== 'none') c.style.display = 'none'
        syncDomClass(false, meVisible)
        meVisible = false
        return
      }
      if (!themeVars.enabled) {
        if (c.style.display !== 'none') c.style.display = 'none'
        syncDomClass(false, meVisible)
        meVisible = false
        return
      }
      const rect = tgt.getBoundingClientRect()
      const rootRect = root.getBoundingClientRect()
      if (rect.width < 4 || rect.height < 4) {
        c.style.display = 'none'
        syncDomClass(false, meVisible)
        meVisible = false
        return
      }
      if (c.style.display === 'none') c.style.display = 'block'
      syncDomClass(true, meVisible)
      meVisible = true

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const cssW = Math.round(rect.width)
      const cssH = Math.round(rect.height)
      if (cssW !== lastW || cssH !== lastH) {
        lastW = cssW
        lastH = cssH
        c.width = cssW * dpr
        c.height = cssH * dpr
        g.viewport(0, 0, c.width, c.height)
      }
      c.style.width = cssW + 'px'
      c.style.height = cssH + 'px'
      c.style.left = Math.round(rect.left) + 'px'
      c.style.top = Math.round(rect.top) + 'px'

      // 背景纹理（变化才上传）
      uploadContentTex(rasterizeBackground())

      // 指针（面板局部坐标，带平滑跟随）
      const localX = pointerX - rect.left
      const localY = pointerY - rect.top
      const inside =
        localX >= -40 && localX <= rect.width + 40 && localY >= -40 && localY <= rect.height + 40
      const pointerA = inside ? 1 : 0
      smPointerX += (Math.min(Math.max(localX, 0), rect.width) - smPointerX) * 0.16
      smPointerY += (Math.min(Math.max(localY, 0), rect.height) - smPointerY) * 0.16
      smPointerA += (pointerA - smPointerA) * 0.1

      g.useProgram(prog)
      g.bindTexture(g.TEXTURE_2D, contentTex)
      g.uniform2f(uni('u_panelSize'), rect.width, rect.height)
      g.uniform1f(uni('u_radius'), param.radius)
      g.uniform2f(
        uni('u_windowSize'),
        root.clientWidth || rect.width * 3,
        root.clientHeight || rect.height * 3
      )
      g.uniform2f(uni('u_panelPos'), rect.left - rootRect.left, rect.top - rootRect.top)
      g.uniform1f(uni('u_refractionHeight'), param.refractionHeight)
      g.uniform1f(uni('u_refractionAmount'), param.refractionAmount)
      g.uniform1f(uni('u_depthEffect'), param.depthEffect)
      g.uniform1f(uni('u_chromatic'), param.chromatic)
      g.uniform1f(uni('u_edgeFalloff'), param.edgeFalloff)
      g.uniform4fv(uni('u_edgeColor'), themeVars.edge)
      g.uniform4fv(uni('u_tint'), themeVars.tint)
      g.uniform4fv(uni('u_base'), themeVars.base)
      g.uniform4fv(uni('u_glowColor'), themeVars.edge)
      g.uniform2f(uni('u_pointer'), smPointerX, smPointerY)
      g.uniform1f(uni('u_pointerA'), smPointerA)
      g.uniform1f(uni('u_sheen'), param.sheen)
      g.uniform1f(uni('u_glow'), param.glow)
      g.uniform1f(uni('u_time'), performance.now() / 1000)
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4)
    }

    themeTimer = window.setInterval(readThemeVars, 500)
    rafId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafId)
      window.clearInterval(themeTimer)
      window.removeEventListener('pointermove', onPointerMove)
      syncDomClass(false, meVisible)
      meVisible = false
    }
    // target/variant 是静态配置（挂载一次）；主题变量与玻璃开关走 500ms 轮询，不重挂载
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        zIndex: 0,
        pointerEvents: 'none',
        display: 'none'
      }}
    />
  )
}
