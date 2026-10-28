// 四套外观主题（v2.3.0：紫金黑/自定义/纯黑/纯白）—— 仅改变外观，不含任何功能逻辑
// 液态玻璃：开 = 透明底 + 背景渐变 + 漂移光斑（CSS）+ 可选 WebGL 叠层（LiquidGlass 组件）
import { extendTheme, type Theme } from '@chakra-ui/react'
import {
  accentScale,
  DEFAULT_ACCENT,
  hexToRgb,
  mixColor,
  type ThemeKey,
  ZJ_ACCENT,
  ZJ_GOLD
} from '../../../shared/theme'

export function hexToRgba(hex: string, alpha: number): string {
  const c = hexToRgb(hex) ?? hexToRgb(DEFAULT_ACCENT)!
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`
}

interface SurfaceTokens {
  colorMode: 'dark' | 'light'
  appBg: string
  panel: string
  panelStrong: string
  border: string
  hover: string
  sidebar: string
  bar: string
  textPrimary: string
  textMuted: string
  inputBg: string
  /** 玻璃开启时的 body 背景（静态渐变，WebGL 折射源栅格化它） */
  glassBg: string
  /** 漂移光斑颜色（b1/b2），玻璃开时可见 */
  blob1: string
  blob2: string
  blobOpacity: number
  /** v2.5.0：内容区玻璃表面材质配方（见 SurfaceMaterial） */
  material: SurfaceMaterial
}

// v2.5.0 表面材质配方：内容区玻璃的六层落地参数（按主题调校；折射归 WebGL 领地、
// 交互弹簧归组件。设计准则与互斥规则取自液态玻璃规范，取值在设计期校准，不做运行时钳制）
interface SurfaceMaterial {
  /** 磨砂模糊 px（表面层主控；0 = 清水玻璃） */
  blur: number
  /** 饱和提升 %（颜色层：介质集光） */
  saturate: number
  /** 亮度提升 ×（颜色层：玻璃要比背景亮半档才像玻璃） */
  brightness: number
  /** 玻璃底对角渐变亮/暗端（颜色层：135° 渐变制造体积感） */
  glassHi: string
  glassLo: string
  /** 玻璃边框色（几何/颜色层：玻璃边界在背景上的可见性兜底） */
  border: string
  /** 顶部棱线 / 底部缘光（光照层：上亮下暗双棱线 = 玻璃厚度感第一信号） */
  rimTop: string
  rimBottom: string
  /** 内泛光（光照层：玻璃内部雾状提亮 = 体积感） */
  innerGlow: string
  /** 流动光泽带峰值色（光照层 sheen；含峰值 alpha，浅色主题换色调） */
  sheenColor: string
  /** 指针光斑色（光照层：hover 时在玻璃表面游走的径向高光） */
  spot: string
  /** 外投影（光照层：让玻璃从背景上浮起） */
  shadow: string
  /** 背景锥形缓转层渐变（动态层：整体色相流动，90s 一转） */
  conic: string
  /** 全屏噪点透明度（表面层：打散大面积渐变的色带） */
  grainOpacity: number
}

// v2.3.1：chrome 件金/发丝令牌（按主题注入 CSS 变量；紫金黑带金元素，其余中性）
interface ChromeTokens {
  /** 面板发丝边（侧栏右边/底栏/状态栏顶边；紫金黑 = 金发丝） */
  edge: string
  /** 激活导航胶囊背景（紫金黑 = 紫金渐变；其余 = brand-600） */
  pill: string
  /** Android 底栏顶部指示条（紫金黑 = 紫金渐变；其余 = 强调色） */
  indicator: string
  /** 侧栏 Logo 金条（紫金黑 = 金色渐隐；其余 = 透明） */
  logoBar: string
  /** 金色外辉光（紫金黑 = 金；其余 = 透明） */
  goldGlow: string
  /** WebGL 接管时 chrome 底板减纱值（折射体透出来，玻璃更明显） */
  sidebarLiquid: string
  barLiquid: string
}

const CHROME: Record<ThemeKey, ChromeTokens> = {
  zj: {
    // 紫金黑：金发丝描边 + 紫金渐变胶囊/指示条 + Logo 金条 + 金色环境辉光
    edge: hexToRgba(ZJ_GOLD, 0.55),
    pill: `linear-gradient(118deg, ${mixColor(ZJ_ACCENT, '#000000', 0.16)} 0%, ${ZJ_ACCENT} 55%, ${ZJ_GOLD} 135%)`,
    indicator: `linear-gradient(90deg, ${ZJ_ACCENT}, ${ZJ_GOLD})`,
    logoBar: `linear-gradient(90deg, ${hexToRgba(ZJ_GOLD, 0.95)}, ${hexToRgba(ZJ_GOLD, 0)} 90%)`,
    goldGlow: hexToRgba(ZJ_GOLD, 0.22),
    sidebarLiquid: 'rgba(24,14,40,0.2)',
    barLiquid: 'rgba(20,10,36,0.24)'
  },
  custom: {
    edge: 'rgba(255,255,255,0.16)',
    pill: 'var(--chakra-colors-brand-600)',
    indicator: 'var(--pbox-accent)',
    logoBar: 'transparent',
    goldGlow: 'transparent',
    sidebarLiquid: 'rgba(10,20,40,0.18)',
    barLiquid: 'rgba(8,16,32,0.22)'
  },
  black: {
    edge: '#2e2e2e',
    pill: 'var(--chakra-colors-brand-600)',
    indicator: 'var(--pbox-accent)',
    logoBar: 'transparent',
    goldGlow: 'transparent',
    sidebarLiquid: 'rgba(5,5,5,0.55)',
    barLiquid: 'rgba(10,10,10,0.6)'
  },
  white: {
    edge: '#d9d9d9',
    pill: 'var(--chakra-colors-brand-600)',
    indicator: 'var(--pbox-accent)',
    logoBar: 'transparent',
    goldGlow: 'transparent',
    sidebarLiquid: 'rgba(245,245,245,0.6)',
    barLiquid: 'rgba(247,247,247,0.65)'
  }
}

// WebGL 玻璃色（LiquidGlass 组件消费的 CSS 变量；CSS 玻璃兜底时不使用）
interface GlassCssVars {
  edge: string
  tint: string
  base: string
}

const SURFACES: Record<ThemeKey, SurfaceTokens> = {
  zj: {
    colorMode: 'dark',
    appBg: '#0d0817',
    panel: 'rgba(255,255,255,0.08)',
    panelStrong: 'rgba(255,255,255,0.13)',
    border: 'rgba(255,255,255,0.16)',
    hover: 'rgba(255,255,255,0.10)',
    sidebar: 'rgba(24,14,40,0.36)',
    bar: 'rgba(20,10,36,0.42)',
    textPrimary: 'gray.50',
    textMuted: 'gray.300',
    inputBg: 'rgba(255,255,255,0.10)',
    // 深紫金底 + 紫晕/金晕（v2.3.1：晕更强，玻璃折射源更亮）
    glassBg: `radial-gradient(1100px 700px at 18% -10%, ${hexToRgba(ZJ_ACCENT, 0.7)}, transparent 62%), radial-gradient(900px 620px at 88% 108%, ${hexToRgba(ZJ_GOLD, 0.5)}, transparent 62%), #0d0817`,
    blob1: ZJ_ACCENT,
    blob2: ZJ_GOLD,
    blobOpacity: 0.65,
    // 紫金黑：玻璃锁死开的基准配方——磨砂足、金/紫氛围、光泽带与光斑按深色玻璃调校
    material: {
      blur: 18,
      saturate: 150,
      brightness: 1.07,
      glassHi: 'rgba(255,255,255,0.14)',
      glassLo: 'rgba(255,255,255,0.05)',
      border: 'rgba(255,255,255,0.16)',
      rimTop: 'rgba(255,255,255,0.30)',
      rimBottom: 'rgba(255,255,255,0.08)',
      innerGlow: 'rgba(255,255,255,0.05)',
      sheenColor: 'rgba(255,255,255,0.13)',
      spot: 'rgba(255,255,255,0.16)',
      shadow: '0 10px 34px rgba(3,0,20,0.35)',
      conic:
        'conic-gradient(from 0deg at 50% 50%, rgba(124,58,237,0.15), rgba(232,179,62,0.10), rgba(6,182,212,0.11), rgba(236,72,153,0.09), rgba(124,58,237,0.15))',
      grainOpacity: 0.07
    }
  },
  custom: {
    colorMode: 'dark',
    appBg: '#0a1428',
    panel: 'rgba(255,255,255,0.08)',
    panelStrong: 'rgba(255,255,255,0.13)',
    border: 'rgba(255,255,255,0.16)',
    hover: 'rgba(255,255,255,0.10)',
    sidebar: 'rgba(10,20,40,0.32)',
    bar: 'rgba(8,16,32,0.38)',
    textPrimary: 'gray.50',
    textMuted: 'gray.300',
    inputBg: 'rgba(255,255,255,0.10)',
    // 深色蓝底 + 强调色晕（accent 运行时注入；v2.3.1：晕更强）
    glassBg: `radial-gradient(1000px 640px at 20% -10%, ${hexToRgba(DEFAULT_ACCENT, 0.55)}, transparent 62%), radial-gradient(800px 560px at 90% 110%, rgba(124,92,255,0.42), transparent 62%), #0a1428`,
    blob1: DEFAULT_ACCENT,
    blob2: '#7c5cff',
    blobOpacity: 0.65,
    // 自定义：与紫金黑同档深色配方（无金色系，氛围色偏中性蓝紫）
    material: {
      blur: 18,
      saturate: 148,
      brightness: 1.06,
      glassHi: 'rgba(255,255,255,0.14)',
      glassLo: 'rgba(255,255,255,0.05)',
      border: 'rgba(255,255,255,0.16)',
      rimTop: 'rgba(255,255,255,0.28)',
      rimBottom: 'rgba(255,255,255,0.08)',
      innerGlow: 'rgba(255,255,255,0.05)',
      sheenColor: 'rgba(255,255,255,0.12)',
      spot: 'rgba(255,255,255,0.15)',
      shadow: '0 10px 34px rgba(2,4,16,0.35)',
      conic:
        'conic-gradient(from 0deg at 50% 50%, rgba(124,58,237,0.13), rgba(6,182,212,0.10), rgba(236,72,153,0.08), rgba(96,165,250,0.09), rgba(124,58,237,0.13))',
      grainOpacity: 0.07
    }
  },
  black: {
    colorMode: 'dark',
    appBg: '#000000',
    panel: '#0a0a0a',
    panelStrong: '#161616',
    border: '#232323',
    hover: '#1c1c1c',
    sidebar: '#050505',
    bar: '#0a0a0a',
    textPrimary: '#ededed',
    textMuted: '#8f8f8f',
    inputBg: '#111111',
    // 纯黑底 + 微弱强调色晕（玻璃开时给折射源一点变化；v2.3.1：提亮一档）
    glassBg: `radial-gradient(900px 600px at 50% -20%, ${hexToRgba(DEFAULT_ACCENT, 0.35)}, transparent 65%), #000000`,
    blob1: hexToRgba(DEFAULT_ACCENT, 0.5),
    blob2: 'rgba(124,92,255,0.3)',
    blobOpacity: 0.45,
    // 纯黑：玻璃手动开启时底色更实一档（深底上玻璃要可见），氛围更收敛
    material: {
      blur: 20,
      saturate: 140,
      brightness: 1.05,
      glassHi: 'rgba(255,255,255,0.16)',
      glassLo: 'rgba(255,255,255,0.07)',
      border: '#232323',
      rimTop: 'rgba(255,255,255,0.24)',
      rimBottom: 'rgba(255,255,255,0.07)',
      innerGlow: 'rgba(255,255,255,0.04)',
      sheenColor: 'rgba(255,255,255,0.10)',
      spot: 'rgba(255,255,255,0.14)',
      shadow: '0 10px 34px rgba(0,0,0,0.5)',
      conic:
        'conic-gradient(from 0deg at 50% 50%, rgba(124,58,237,0.08), rgba(6,182,212,0.06), rgba(124,58,237,0.08))',
      grainOpacity: 0.06
    }
  },
  white: {
    colorMode: 'light',
    appBg: '#ffffff',
    panel: '#fafafa',
    panelStrong: '#f0f0f0',
    border: '#e6e6e6',
    hover: '#f5f5f5',
    sidebar: '#f5f5f5',
    bar: '#f7f7f7',
    textPrimary: '#171717',
    textMuted: '#6b6b6b',
    inputBg: '#ffffff',
    // 纯白底 + 极淡强调色晕（v2.3.1：提亮一档）
    glassBg: `radial-gradient(900px 600px at 50% -20%, ${hexToRgba(DEFAULT_ACCENT, 0.24)}, transparent 65%), #ffffff`,
    blob1: hexToRgba(DEFAULT_ACCENT, 0.35),
    blob2: 'rgba(124,92,255,0.2)',
    blobOpacity: 0.4,
    // 纯白：浅色玻璃——底更白才和背景分层，棱线转浅色调，光斑/光泽带用淡紫可见色
    material: {
      blur: 16,
      saturate: 135,
      brightness: 1.02,
      glassHi: 'rgba(255,255,255,0.55)',
      glassLo: 'rgba(255,255,255,0.32)',
      border: '#e2e2e2',
      rimTop: 'rgba(255,255,255,0.70)',
      rimBottom: 'rgba(15,23,42,0.08)',
      innerGlow: 'rgba(124,92,255,0.07)',
      sheenColor: 'rgba(124,92,255,0.14)',
      spot: 'rgba(124,92,255,0.12)',
      shadow: '0 10px 34px rgba(15,23,42,0.10)',
      conic:
        'conic-gradient(from 0deg at 50% 50%, rgba(124,58,237,0.06), rgba(6,182,212,0.05), rgba(236,72,153,0.04), rgba(124,58,237,0.06))',
      grainOpacity: 0.05
    }
  }
}

// v2.5.0：玻璃关时的朴素面板值（.pbox-glass 变量退化）——半透配方换成实色面板，
// backdrop 直接给 none（不产生无谓的合成开销），棱线/泛光/光泽/光斑全关
function flatMaterial(s: SurfaceTokens): SurfaceMaterial {
  return {
    blur: 0,
    saturate: 100,
    brightness: 1,
    glassHi: s.panelStrong,
    glassLo: s.panel,
    border: s.border,
    rimTop: 'transparent',
    rimBottom: 'transparent',
    innerGlow: 'transparent',
    sheenColor: 'transparent',
    spot: 'transparent',
    shadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.06)',
    conic: 'none',
    grainOpacity: 0
  }
}

// 玻璃 CSS 变量（按主题定死；v2.3.1：整体提一档——边缘发丝/染色/底板更明显；
// WebGL 玻璃不可用时仅 CSS 玻璃，变量不参与）
function glassVarsOf(themeKey: ThemeKey, accent: string): GlassCssVars {
  const a = hexToRgb(accent) ?? hexToRgb(DEFAULT_ACCENT)!
  switch (themeKey) {
    case 'zj':
      // 紫金黑：金色发丝描边 + 紫晕染色 + 半透深紫金底板（观感基准 = XingyuMusic 紫金黑底栏）
      return { edge: hexToRgba(ZJ_GOLD, 0.9), tint: hexToRgba(ZJ_ACCENT, 0.45), base: 'rgba(13,8,23,0.6)' }
    case 'custom':
      return {
        edge: 'rgba(255,255,255,0.34)',
        tint: `rgba(${a.r},${a.g},${a.b},0.26)`,
        base: 'rgba(10,20,40,0.62)'
      }
    case 'black':
      return {
        edge: 'rgba(255,255,255,0.28)',
        tint: `rgba(${a.r},${a.g},${a.b},0.22)`,
        base: 'rgba(0,0,0,0.68)'
      }
    case 'white':
      return {
        edge: 'rgba(15,23,42,0.22)',
        tint: `rgba(${a.r},${a.g},${a.b},0.15)`,
        base: 'rgba(255,255,255,0.6)'
      }
  }
  return { edge: 'transparent', tint: 'transparent', base: 'transparent' }
}

// 构建基础样式 + 通用动画 keyframes（所有主题都有）
// v2.1.0 动效原则：平滑 ease-out、不过冲、不闪烁——去除"廉价感"的过冲弹簧与流光扫光
function makeStyles(effectiveAccent: string) {
  return {
    global: {
      ':root': {
        '--pbox-accent': effectiveAccent,
        '--pbox-accent-soft': hexToRgba(effectiveAccent, 0.35)
      },
      body: {
        overflow: 'hidden'
      },
      '#root': { height: '100vh' },
      // v2.3.0：主题化细滚动条（三主题通用的中性灰，悬浮加深）
      '::-webkit-scrollbar': {
        width: '10px',
        height: '10px'
      },
      '::-webkit-scrollbar-track': {
        background: 'transparent'
      },
      '::-webkit-scrollbar-thumb': {
        background: 'rgba(128, 138, 158, 0.32)',
        borderRadius: '8px',
        border: '2px solid transparent',
        backgroundClip: 'padding-box'
      },
      '::-webkit-scrollbar-thumb:hover': {
        background: 'rgba(128, 138, 158, 0.55)',
        border: '2px solid transparent',
        backgroundClip: 'padding-box'
      },
      '::-webkit-scrollbar-corner': {
        background: 'transparent'
      },
      // v2.3.0：键盘焦点可见性（无障碍；鼠标点击不触发）
      ':focus-visible': {
        outline: '2px solid var(--pbox-accent)',
        outlineOffset: '2px'
      },
      // v2.3.0：统一平滑过渡（替代过冲贝塞尔，观感更沉稳）
      '.chakra-button, a, [role="button"]': {
        transition: 'color .18s ease, background-color .18s ease, border-color .18s ease, opacity .18s ease'
      },
      // ── v2.5.0 内容区玻璃材质类（六层模型的表面/光照/颜色层 CSS 落地）──
      // 全主题注册：玻璃开时消费 --pbox-g-* 玻璃配方；玻璃关时变量退化为朴素面板值
      // （flatMaterial），组件无条件挂用、无需感知玻璃开关。
      // 玻璃底对角渐变 + backdrop 磨砂/提饱和/提亮 + 双棱线 + 内泛光 + 外投影
      '.pbox-glass': {
        position: 'relative',
        isolation: 'isolate',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, var(--pbox-g-hi) 0%, var(--pbox-g-lo) 100%)',
        backdropFilter: 'var(--pbox-g-backdrop, none)',
        WebkitBackdropFilter: 'var(--pbox-g-backdrop, none)',
        border: '1px solid var(--pbox-g-border)',
        boxShadow:
          'inset 0 1px 0 var(--pbox-g-rim-top), inset 0 -1px 0 var(--pbox-g-rim-bottom), inset 0 0 28px var(--pbox-g-inner-glow), var(--pbox-g-shadow)'
      },
      // 指针光斑：跟全局 --mx/--my（液体阻尼 lerp）在玻璃表面游走，hover 时浮现；
      // 玻璃关时 --pbox-g-spot 为透明 → 永不显现
      '.pbox-glass::after': {
        content: '""',
        position: 'absolute',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
        background:
          'radial-gradient(280px circle at calc(50% + var(--mx, 0) * 46%) calc(50% + var(--my, 0) * 46%), var(--pbox-g-spot), transparent 62%)',
        opacity: 0,
        transition: 'opacity .45s ease'
      },
      '.pbox-glass:hover::after': {
        opacity: 1
      },
      // 减少动效：指针光斑不做淡入过渡
      '@media (prefers-reduced-motion: reduce)': {
        '.pbox-glass::after': {
          transition: 'none'
        }
      },
      // 形变微动效（v2.4.0：悬停轻浮 + 玻璃卡内缘高光提亮）
      '.pbox-morph': {
        transition:
          'transform .22s ease-out, box-shadow .28s ease, background-color .18s ease, border-color .18s ease'
      },
      '.pbox-morph:hover': {
        transform: 'translateY(-2px)'
      },
      // v2.4.0：胶囊流光（GlassButton 悬停时一道液面高光扫过；层裁圆角、外阴影不受影响）
      '.pbox-glint-layer': {
        position: 'absolute',
        inset: 0,
        borderRadius: 'inherit',
        overflow: 'hidden',
        pointerEvents: 'none'
      },
      '.pbox-glint-layer::after': {
        content: '""',
        position: 'absolute',
        inset: 0,
        borderRadius: 'inherit',
        background:
          'linear-gradient(105deg, transparent 34%, rgba(255,255,255,0.30) 48%, transparent 62%)',
        transform: 'translateX(-130%)',
        transition: 'transform 0.6s cubic-bezier(0.2, 0, 0, 1)',
        willChange: 'transform'
      },
      '.pbox-glint:hover:not(:disabled) > .pbox-glint-layer::after': {
        transform: 'translateX(130%)'
      },
      // v2.4.0：侧栏导航悬停胶囊（非激活项）——玻璃胶囊内嵌高亮
      '.pbox-nav-item': {
        transition: 'background-color .18s ease, color .18s ease'
      },
      '.pbox-nav-item:not(.pbox-nav-item-active):hover': {
        background: 'var(--chakra-colors-hoverbg, rgba(255,255,255,0.08))'
      },
      // 居中液态玻璃弹窗（blur40 + 圆角20 + 细白半透边框）
      '.pbox-modal-overlay': {
        background: 'rgba(2,6,18,0.45)',
        backdropFilter: 'blur(40px) saturate(140%)',
        WebkitBackdropFilter: 'blur(40px) saturate(140%)'
      },
      '.pbox-modal-panel': {
        borderRadius: '20px',
        border: '1px solid rgba(255,255,255,0.22)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12)',
        background: 'rgba(22,30,55,0.6)',
        backdropFilter: 'blur(40px) saturate(160%)',
        WebkitBackdropFilter: 'blur(40px) saturate(160%)',
        overflow: 'hidden',
        position: 'relative'
      },
      // 下拉刷新玻璃圆盘（淡蓝半透液态玻璃 + 圆角50%）
      '.pbox-ptr-disc': {
        position: 'absolute',
        left: '50%',
        top: 0,
        width: '68px',
        height: '68px',
        marginLeft: '-34px',
        borderRadius: '9999px',
        background:
          'linear-gradient(160deg, rgba(180,220,255,0.30) 0%, rgba(255,255,255,0.10) 100%)',
        border: '1px solid rgba(255,255,255,0.30)',
        backdropFilter: 'blur(18px) saturate(150%)',
        WebkitBackdropFilter: 'blur(18px) saturate(150%)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.30)',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        willChange: 'transform, opacity'
      },
      // 刷新成功扩散波纹
      '.pbox-ptr-ring': {
        position: 'absolute',
        inset: 0,
        borderRadius: '9999px',
        border: '2px solid rgba(255,255,255,0.55)',
        pointerEvents: 'none',
        animation: 'pboxRippleRing 0.6s ease-out forwards'
      },
      '@keyframes pboxRippleRing': {
        '0%': { transform: 'scale(0.4)', opacity: '0.9' },
        '100%': { transform: 'scale(2.3)', opacity: '0' }
      }
    }
  }
}

// 液态玻璃开启时的额外样式：背景色斑漂移 + 各层次模糊 + WebGL 玻璃激活态
// v2.1.0：blur 110px→64px 降 GPU 负担；窗口隐藏/系统减少动效偏好时暂停漂移
// v2.3.1：玻璃效果提强——磨砂 blur 加深 + 内缘高光发丝 + chrome 金色辉光（紫金黑）+
// WebGL 接管时 chrome 底板减纱（折射体透出来）
function makeGlassExtra(surface: SurfaceTokens, blob1: string, chrome: ChromeTokens) {
  const { blob2, blobOpacity, material: m } = surface
  return {
    global: {
      // ── v2.5.0 背景流动层：锥形渐变整层缓转 + 三光斑互质周期 ──
      // 性能三原则（只动 transform；blur 固定挂元素不逐帧变；色相流动=整层旋转）
      '.pbox-conic': {
        position: 'fixed',
        inset: '-35%',
        zIndex: 0,
        pointerEvents: 'none',
        background: 'var(--pbox-conic-bg)',
        filter: 'blur(70px)',
        animation: 'pboxSpin 90s linear infinite',
        willChange: 'transform'
      },
      '@keyframes pboxSpin': {
        to: { transform: 'rotate(1turn)' }
      },
      // 三团光斑：26s/34s/19s 互质周期 + 异路径异相位，消除同周期的机械同步感
      '.pbox-blob': {
        position: 'fixed',
        pointerEvents: 'none',
        borderRadius: '9999px',
        filter: 'blur(64px)',
        opacity: String(blobOpacity),
        zIndex: 0,
        animation: 'pboxDrift1 26s ease-in-out infinite alternate'
      },
      '.pbox-blob.b1': {
        width: '46vw',
        height: '46vw',
        left: '-10vw',
        top: '-14vw',
        background: `radial-gradient(circle, ${blob1} 0%, transparent 70%)`
      },
      '.pbox-blob.b2': {
        width: '40vw',
        height: '40vw',
        right: '-10vw',
        bottom: '-12vw',
        background: `radial-gradient(circle, ${blob2} 0%, transparent 70%)`,
        animation: 'pboxDrift2 34s ease-in-out infinite alternate-reverse',
        animationDelay: '-9s'
      },
      '.pbox-blob.b3': {
        width: '30vw',
        height: '30vw',
        left: '38vw',
        bottom: '2vw',
        background: 'radial-gradient(circle, #c084fc 0%, transparent 70%)',
        animation: 'pboxDrift3 19s ease-in-out infinite alternate',
        animationDelay: '-5s'
      },
      // 全屏细噪点：打散大面积渐变的色带（banding），overlay 混合在深浅主题上都自然
      '.pbox-grain': {
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        opacity: 'var(--pbox-grain-opacity, 0.07)',
        mixBlendMode: 'overlay',
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")"
      },
      // ── v2.5.0 流动光泽带（玻璃开独占）：斜向高光带周期扫过（划完停半拍再循环）；
      // --pbox-sheen-delay 供卡片错相；玻璃关时类不存在于样式表，零成本
      '.pbox-sheen::before': {
        content: '""',
        position: 'absolute',
        inset: '-40% -60%',
        zIndex: -1,
        pointerEvents: 'none',
        background:
          'linear-gradient(105deg, transparent 38%, var(--pbox-g-sheen-color) 50%, transparent 62%)',
        transform: 'translateX(-60%) skewX(-14deg)',
        animation: 'pboxSheen 14s ease-in-out infinite',
        animationDelay: 'var(--pbox-sheen-delay, 0s)',
        willChange: 'transform'
      },
      '@keyframes pboxSheen': {
        '0%': { transform: 'translateX(-60%) skewX(-14deg)' },
        '55%': { transform: 'translateX(60%) skewX(-14deg)' },
        '100%': { transform: 'translateX(60%) skewX(-14deg)' }
      },
      // v2.1.0：窗口隐藏到托盘时暂停漂移动画（后台 0 GPU 占用）——v2.5.0 扩到锥转/光泽带
      'body.pbox-bg-paused .pbox-blob': {
        animationPlayState: 'paused'
      },
      'body.pbox-bg-paused .pbox-conic': {
        animationPlayState: 'paused'
      },
      'body.pbox-bg-paused .pbox-sheen::before': {
        animationPlayState: 'paused'
      },
      // 系统级"减少动效"偏好：全部动态层静止（光泽带停在半程，光斑/锥转消失）
      '@media (prefers-reduced-motion: reduce)': {
        '.pbox-blob': {
          animation: 'none'
        },
        '.pbox-conic': {
          animation: 'none'
        },
        '.pbox-sheen::before': {
          animation: 'none',
          transform: 'translateX(0) skewX(-14deg)'
        }
      },
      // v2.3.1：磨砂加深 + 内缘高光发丝（玻璃体轮廓感）
      '.pbox-blur-sidebar': {
        backdropFilter: 'blur(30px) saturate(165%)',
        WebkitBackdropFilter: 'blur(30px) saturate(165%)'
      },
      '.pbox-blur-panel': {
        backdropFilter: 'blur(18px) saturate(145%)',
        WebkitBackdropFilter: 'blur(18px) saturate(145%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)'
      },
      '.pbox-blur-bar': {
        backdropFilter: 'blur(26px) saturate(155%)',
        WebkitBackdropFilter: 'blur(26px) saturate(155%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10)'
      },
      // v2.3.1：chrome 件金色环境辉光（仅紫金黑非空；其余主题 transparent 无观感）
      // v2.4.0：胶囊化——加悬浮投影（板体离开边缘漂浮），外阴影 + 金辉光 + 内缘发丝
      '#pbox-sidebar': {
        boxShadow: `0 10px 34px rgba(0,0,0,0.38), 0 0 26px var(--pbox-gold-glow, transparent), inset 0 1px 0 rgba(255,255,255,0.07)`
      },
      '#pbox-bottomnav': {
        boxShadow: `0 -6px 26px rgba(0,0,0,0.30), 0 0 26px var(--pbox-gold-glow, transparent), inset 0 1px 0 rgba(255,255,255,0.07)`
      },
      // v2.3.1：侧栏 Logo 金条（紫金黑：金色渐隐横条；其余主题透明）
      '.pbox-logo': {
        position: 'relative',
        display: 'inline-block',
        paddingBottom: '6px'
      },
      '.pbox-logo::after': {
        content: '""',
        position: 'absolute',
        left: 0,
        bottom: 0,
        width: '100%',
        height: '2px',
        borderRadius: '2px',
        background: 'var(--pbox-logo-bar, transparent)'
      },
      // v2.3.0：WebGL LiquidGlass 叠层接管侧栏/Android 底栏玻璃体时（documentElement.pbox-liquid-active），
      // 撤掉被接管面板的 CSS 磨砂——折射/色散/边缘流光改由 GPU 着色器绘制；
      // 面板保留自身半透明底色（canvas 在其下层，自然叠加成磨砂观感，与 Chakra 内联样式无冲突）。
      // 按 id 精确命中：状态栏同用 pbox-blur-bar 但无 canvas 接管，不受影响。
      '.pbox-liquid-active #pbox-sidebar': {
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none'
      },
      '.pbox-liquid-active #pbox-bottomnav': {
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none'
      },
      // v2.3.1：WebGL 接管时 chrome 底板减纱（变量重定义，内联 bg: var(...) 自动生效）——
      // 折射/色散/金色发丝从玻璃体里透出来，液态玻璃观感更明显
      '.pbox-liquid-active': {
        '--pbox-bg-sidebar': chrome.sidebarLiquid,
        '--pbox-bg-bar': chrome.barLiquid
      },
      // 三条异路径漂移：与 26s/34s/19s 互质周期配合，光斑永不整体重复
      '@keyframes pboxDrift1': {
        '0%': { transform: 'translate(0, 0) scale(1)' },
        '50%': { transform: 'translate(6vw, 4vh) scale(1.12)' },
        '100%': { transform: 'translate(-4vw, 6vh) scale(0.94)' }
      },
      '@keyframes pboxDrift2': {
        '0%': { transform: 'translate(0, 0) scale(1.15)' },
        '50%': { transform: 'translate(-8vw, -5vh) scale(0.9)' },
        '100%': { transform: 'translate(5vw, -7vh) scale(1.3)' }
      },
      '@keyframes pboxDrift3': {
        '0%': { transform: 'translate(-6vw, -4vh) scale(1)' },
        '50%': { transform: 'translate(4vw, 6vh) scale(1.3)' },
        '100%': { transform: 'translate(10vw, -8vh) scale(0.95)' }
      }
    }
  }
}

// 主题工厂：accent 仅自定义主题可自定义，其余固定默认色
// glassOn = 当前生效的液态玻璃开关（锁死主题恒 true）
// Chakra v2 返回 Theme；本函数额外注入 semanticTokens/global keyframes/blur tokens 等扩展。
// 合并时以对象展开方式绕过 strict 约束；运行时完全兼容 Theme 接口。
export function buildTheme(themeKey: ThemeKey, accent: string, glassOn: boolean): Theme {
  const s = SURFACES[themeKey]
  const chrome = CHROME[themeKey]
  // v2.5.0：玻璃开 = 主题材质配方；关 = 朴素面板值（.pbox-glass 变量退化，组件无需感知开关）
  const m = glassOn ? s.material : flatMaterial(s)
  const effectiveAccent =
    themeKey === 'custom' ? accent : themeKey === 'zj' ? ZJ_ACCENT : DEFAULT_ACCENT
  const gvars = glassVarsOf(themeKey, effectiveAccent)
  // 主光斑色：自定义主题跟随用户强调色；其余主题用预设
  const blob1 = themeKey === 'custom' ? effectiveAccent : s.blob1

  const baseStyles = makeStyles(effectiveAccent)
  // 玻璃开：body 用静态渐变（WebGL 折射源）；关：主题固有色
  const bodyBg = glassOn ? s.glassBg : s.appBg
  const bodyOverride = { body: { overflow: 'hidden', background: bodyBg } }

  const config = {
    config: { initialColorMode: s.colorMode, useSystemColorMode: false },
    colors: { brand: accentScale(effectiveAccent) },
    // v2.1.0：系统中文字体栈（替代 Chakra 默认，避免跨平台观感漂移）
    fonts: {
      heading:
        '"Segoe UI", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", system-ui, sans-serif',
      body: '"Segoe UI", "Microsoft YaHei", "PingFang SC", "Noto Sans SC", system-ui, sans-serif'
    },
    semanticTokens: {
      colors: {
        appbg: { default: s.appBg },
        panel: { default: s.panel },
        panelstrong: { default: s.panelStrong },
        pborder: { default: s.border },
        hoverbg: { default: s.hover },
        sidebarbg: { default: s.sidebar },
        barbg: { default: s.bar },
        ptext: { default: s.textPrimary },
        ptextmuted: { default: s.textMuted },
        pinput: { default: s.inputBg }
      }
    },
    styles: {
      global: {
        ...baseStyles.global,
        ...bodyOverride,
        // 液态玻璃总开关 + WebGL 组件消费的玻璃色变量（CSS 玻璃不可用/未启用时仅占位）
        // v2.3.1：chrome 件变量（发丝边/胶囊/指示条/Logo 金条/金色辉光/底板减纱）
        ':root': {
          ...(baseStyles.global[':root'] as object),
          '--liquid-glass': glassOn ? 'true' : 'false',
          '--color-glass-edge': gvars.edge,
          '--color-glass-tint': gvars.tint,
          '--color-glass-base': gvars.base,
          '--pbox-bg-sidebar': s.sidebar,
          '--pbox-bg-bar': s.bar,
          '--pbox-edge': chrome.edge,
          '--pbox-pill': chrome.pill,
          '--pbox-indicator': chrome.indicator,
          '--pbox-logo-bar': chrome.logoBar,
          '--pbox-gold-glow': chrome.goldGlow,
          // v2.5.0：表面材质配方变量（.pbox-glass/.pbox-sheen/.pbox-conic/.pbox-grain 消费）
          '--pbox-g-backdrop': glassOn
            ? `blur(${m.blur}px) saturate(${m.saturate}%) brightness(${m.brightness})`
            : 'none',
          '--pbox-g-hi': m.glassHi,
          '--pbox-g-lo': m.glassLo,
          '--pbox-g-border': m.border,
          '--pbox-g-rim-top': m.rimTop,
          '--pbox-g-rim-bottom': m.rimBottom,
          '--pbox-g-inner-glow': m.innerGlow,
          '--pbox-g-sheen-color': m.sheenColor,
          '--pbox-g-spot': m.spot,
          '--pbox-g-shadow': m.shadow,
          '--pbox-conic-bg': m.conic,
          '--pbox-grain-opacity': String(m.grainOpacity)
        },
        ...(glassOn ? (makeGlassExtra(s, blob1, chrome).global as Record<string, unknown>) : {})
      }
    }
  }

  return extendTheme(config) as unknown as Theme
}
