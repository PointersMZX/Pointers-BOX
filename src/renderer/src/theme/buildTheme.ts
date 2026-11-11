// 四套外观主题（v2.3.0：紫金黑/自定义/纯黑/纯白）—— 仅改变外观，不含任何功能逻辑
// 液态玻璃：开 = 透明底 + 背景渐变 + 漂移光斑（CSS）+ 可选 WebGL 叠层（LiquidGlass 组件）
import { extendTheme, type Theme } from '@chakra-ui/react'
import {
  accentScale,
  DEFAULT_ACCENT,
  hexToRgb,
  type ThemeKey
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
  /** 全屏噪点透明度（表面层：打散大面积渐变的色带） */
  grainOpacity: number
  /** v2.6.0：SVG 位移折射强度倍率（内容卡 .pbox-glass 的 backdrop 折射；0 = 关闭） */
  refraction: number
  /** v2.6.0：折射圈厚度倍率（SDF 边缘阈值缩放，越大边缘环越宽） */
  refractionEdge: number
}

// v2.3.1：chrome 件金/发丝令牌（按主题注入 CSS 变量；紫金黑带金元素，其余中性）
interface ChromeTokens {
  /** 面板发丝边（侧栏右边/底栏/状态栏顶边；按深浅色给白/暗发丝） */
  edge: string
  /** 激活导航胶囊背景（v2.6.0 = transparent：选中态零色，磨砂+棱线由组件承担） */
  pill: string
  /** Android 底栏顶部指示条（强调色细线：位置指示不是染色） */
  indicator: string
  /** 侧栏 Logo 条（v2.6.0 起恒透明） */
  logoBar: string
  /** 面板外辉光（v2.6.0 起恒透明） */
  goldGlow: string
  /** v2.5.0 遗留（WebGL 退役后无消费，恒透明） */
  sidebarLiquid: string
  barLiquid: string
}

// v2.6.0 全局液态玻璃：激活胶囊不再用实心色块——半透强调色玻璃（透出液态背景）+
// 内缘高光由组件侧 boxShadow 承担；指示条保留（细线是指示不是填充）
// v2.6.0 深浅双色 chrome 令牌：导航选中态零色（磨砂+棱线，见 .chakra-ui-* 变量），
// 指示条保留强调色细线（位置指示不是染色）；金系遗产全部退场
const CHROME: Record<ThemeKey, ChromeTokens> = {
  dark: {
    edge: 'rgba(255,255,255,0.14)',
    pill: 'transparent',
    indicator: 'var(--pbox-accent)',
    logoBar: 'transparent',
    goldGlow: 'transparent',
    sidebarLiquid: 'transparent',
    barLiquid: 'transparent'
  },
  light: {
    edge: 'rgba(15,23,42,0.14)',
    pill: 'transparent',
    indicator: 'var(--pbox-accent)',
    logoBar: 'transparent',
    goldGlow: 'transparent',
    sidebarLiquid: 'transparent',
    barLiquid: 'transparent'
  }
}

// WebGL 玻璃色（LiquidGlass 组件消费的 CSS 变量；CSS 玻璃兜底时不使用）
interface GlassCssVars {
  edge: string
  tint: string
  base: string
}

const SURFACES: Record<ThemeKey, SurfaceTokens> = {
  dark: {
    colorMode: 'dark',
    appBg: '#0b0b12',
    panel: 'rgba(255,255,255,0.08)',
    panelStrong: 'rgba(255,255,255,0.13)',
    border: 'rgba(255,255,255,0.14)',
    hover: 'rgba(255,255,255,0.10)',
    sidebar: '#0d0d15',
    bar: '#101018',
    textPrimary: 'gray.50',
    textMuted: 'gray.300',
    inputBg: 'rgba(255,255,255,0.10)',
    // 深色玻璃：介质提亮方向（透过玻璃的背景比周围亮半档）+ 白棱线；零染色
    material: {
      blur: 24,
      saturate: 150,
      brightness: 1.12,
      glassHi: 'transparent',
      glassLo: 'transparent',
      border: 'rgba(255,255,255,0.18)',
      rimTop: 'rgba(255,255,255,0.34)',
      rimBottom: 'rgba(255,255,255,0.10)',
      innerGlow: 'rgba(255,255,255,0.05)',
      sheenColor: 'rgba(255,255,255,0.12)',
      spot: 'rgba(255,255,255,0.16)',
      shadow: '0 10px 34px rgba(0,0,0,0.50)',
      grainOpacity: 0.06,
      refraction: 1.1,
      refractionEdge: 1.1
    }
  },
  light: {
    colorMode: 'light',
    appBg: '#eef0f4',
    panel: '#ffffff',
    panelStrong: '#f7f8fa',
    border: 'rgba(15,23,42,0.12)',
    hover: 'rgba(15,23,42,0.04)',
    sidebar: '#e8eaf0',
    bar: '#eceef3',
    textPrimary: '#17181c',
    textMuted: '#5b5f6b',
    inputBg: '#ffffff',
    // 浅色玻璃：介质降亮方向（透过玻璃的背景比周围暗半档）+ 白棱线/暗描边；零染色
    material: {
      blur: 22,
      saturate: 140,
      brightness: 0.94,
      glassHi: 'transparent',
      glassLo: 'transparent',
      border: 'rgba(15,23,42,0.16)',
      rimTop: 'rgba(255,255,255,0.95)',
      rimBottom: 'rgba(15,23,42,0.12)',
      innerGlow: 'rgba(255,255,255,0.30)',
      sheenColor: 'rgba(255,255,255,0.50)',
      spot: 'rgba(255,255,255,0.45)',
      shadow: '0 10px 34px rgba(15,23,42,0.14)',
      grainOpacity: 0.05,
      refraction: 1.0,
      refractionEdge: 1.15
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
    grainOpacity: 0,
    refraction: 0,
    refractionEdge: 1
  }
}

// 玻璃 CSS 变量（v2.6.0：WebGL 层退役，tint/base 链路作废——全 transparent 零染色；
// edge 保留：金/白发丝是「棱线」光照，不是染色）
function glassVarsOf(_themeKey: ThemeKey, _accent: string): GlassCssVars {
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
      // v2.6.0 完全液态玻璃：玻璃底渐变已归零（四主题 glassHi/glassLo = transparent），
      // 玻璃卡本体只由 backdrop 折射/磨砂 + 双棱线 + 内泛光 + 外投影构成，不再铺填充底色。
      // 保留 background 这句是为了玻璃关时 flatMaterial 给的朴素面板值仍能生效（同一出口）。
      '.pbox-glass': {
        position: 'relative',
        isolation: 'isolate',
        overflow: 'hidden',
        // v2.6.0：全局些许圆角（资源卡等玻璃卡默认 14px；胶囊件用内联 full 覆盖）
        borderRadius: '14px',
        background: 'linear-gradient(135deg, var(--pbox-g-hi) 0%, var(--pbox-g-lo) 100%)',
        backdropFilter: 'var(--pbox-g-backdrop, none)',
        WebkitBackdropFilter: 'var(--pbox-g-backdrop, none)',
        border: '1px solid var(--pbox-g-border)',
        boxShadow:
          'inset 0 1px 0 var(--pbox-g-rim-top), inset 0 -1px 0 var(--pbox-g-rim-bottom), inset 0 0 28px var(--pbox-g-inner-glow), var(--pbox-g-shadow)'
      },
      // v2.6.0：玻璃发丝分隔线（两端淡出的渐变线，替代实色 Divider 的"实心感"）
      '.pbox-hairline': {
        height: '1px',
        border: 'none',
        background:
          'linear-gradient(90deg, transparent, var(--pbox-g-border, rgba(255,255,255,0.16)) 18%, var(--pbox-g-border, rgba(255,255,255,0.16)) 82%, transparent)'
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
      // v2.6.0：深浅色通用光学变量（导航选中磨砂/棱线、弹窗遮光幕）——零染色
      '.chakra-ui-dark': {
        '--pbox-nav-active': 'rgba(255,255,255,0.10)',
        '--pbox-nav-active-ring': 'rgba(255,255,255,0.22)',
        '--pbox-overlay': 'rgba(0,0,0,0.32)'
      },
      '.chakra-ui-light': {
        '--pbox-nav-active': 'rgba(255,255,255,0.70)',
        '--pbox-nav-active-ring': 'rgba(15,23,42,0.10)',
        '--pbox-overlay': 'rgba(15,23,42,0.16)'
      },
      // 居中液态玻璃弹窗（遮光幕按深浅色减淡——此前 0.45 黑幕把弹窗区域糊成灰）
      '.pbox-modal-overlay': {
        background: 'var(--pbox-overlay, rgba(0,0,0,0.32))',
        backdropFilter: 'blur(40px) saturate(140%)',
        WebkitBackdropFilter: 'blur(40px) saturate(140%)'
      },
      '.pbox-modal-panel': {
        borderRadius: '22px',
        border: '1px solid rgba(255,255,255,0.22)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.16)',
        background: 'transparent',
        backdropFilter: 'blur(40px) saturate(160%)',
        WebkitBackdropFilter: 'blur(40px) saturate(160%)',
        // 浅色下磨砂提亮一档（浅灰底被 blur40 糊后偏灰，介质提亮还原亮玻璃）
        '.chakra-ui-light &': {
          backdropFilter: 'blur(40px) saturate(150%) brightness(1.06)',
          WebkitBackdropFilter: 'blur(40px) saturate(150%) brightness(1.06)',
          border: '1px solid rgba(255,255,255,0.65)'
        },
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
// v2.6.0：玻璃附加层（光泽带/噪点/棱线）——背景光晕层已删（用户定版：背景干净不晕）
function makeGlassExtra(surface: SurfaceTokens, chrome: ChromeTokens) {
  const { material: m } = surface
  return {
    global: {
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
      // v2.1.0：窗口隐藏到托盘时暂停动态层（后台 0 GPU 占用）——v2.6.0 仅剩光泽带
      'body.pbox-bg-paused .pbox-sheen::before': {
        animationPlayState: 'paused'
      },
      // 系统级"减少动效"偏好：全部动态层静止（光泽带停在半程，光斑/锥转消失）
      '@media (prefers-reduced-motion: reduce)': {
        '.pbox-sheen::before': {
          animation: 'none',
          transform: 'translateX(0) skewX(-14deg)'
        }
      },
      // v2.3.1：磨砂加深 + 内缘高光发丝（玻璃体轮廓感）
      // v2.6.0：磨砂串变量化——svgGlass 接管时 inline 写入「url(#折射) + 磨砂」，未接管回落默认
      '.pbox-blur-sidebar': {
        backdropFilter: 'var(--pbox-sb-backdrop, blur(30px) saturate(165%))',
        WebkitBackdropFilter: 'var(--pbox-sb-backdrop, blur(30px) saturate(165%))'
      },
      '.pbox-blur-panel': {
        backdropFilter: 'blur(18px) saturate(145%)',
        WebkitBackdropFilter: 'blur(18px) saturate(145%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)'
      },
      '.pbox-blur-bar': {
        backdropFilter: 'var(--pbox-bn-backdrop, blur(26px) saturate(155%))',
        WebkitBackdropFilter: 'var(--pbox-bn-backdrop, blur(26px) saturate(155%))',
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

// v2.6.0：材质配方出口（svgGlass 内容卡折射层消费折射档位与磨砂尾串；
// 与 buildTheme 同源同退化规则，避免两处口径漂移）
export function getSurfaceMaterial(themeKey: ThemeKey, glassOn: boolean): SurfaceMaterial {
  const s = SURFACES[themeKey]
  return glassOn ? s.material : flatMaterial(s)
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
  // v2.6.0：两主题均使用用户强调色（主按钮/进度条/焦点环；导航选中零色不消费）
  const effectiveAccent = accent
  const gvars = glassVarsOf(themeKey, effectiveAccent)
  // 主光斑色：自定义主题跟随用户强调色；其余主题用预设

  const baseStyles = makeStyles(effectiveAccent)
  // v2.6.0：body 背景恒主题固有色（干净纯色；光晕层已删）
  const bodyBg = s.appBg
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
        // v2.6.0 完全液态玻璃：玻璃开时面板类一律无填充底色（只留折射/磨砂/棱线/光泽），
        // 玻璃关时回落主题实色——组件侧无需感知开关
        panel: { default: glassOn ? 'transparent' : s.panel },
        panelstrong: { default: glassOn ? 'transparent' : s.panelStrong },
        pborder: { default: s.border },
        hoverbg: { default: s.hover },
        sidebarbg: { default: glassOn ? 'transparent' : s.sidebar },
        barbg: { default: glassOn ? 'transparent' : s.bar },
        ptext: { default: s.textPrimary },
        ptextmuted: { default: s.textMuted },
        // 输入框：玻璃开时同样只留描边（内部仍是磨砂玻璃），关时实色
        pinput: { default: glassOn ? 'transparent' : s.inputBg }
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
          // v2.6.0 完全液态玻璃：玻璃开时侧栏/底栏/状态栏无自身填充（磨砂+折射全交给
          // backdrop/WebGL 着色器），关时回落主题实色
          '--pbox-bg-sidebar': glassOn ? 'transparent' : s.sidebar,
          '--pbox-bg-bar': glassOn ? 'transparent' : s.bar,
          '--pbox-edge': chrome.edge,
          '--pbox-pill': chrome.pill,
          '--pbox-indicator': chrome.indicator,
          '--pbox-logo-bar': chrome.logoBar,
          '--pbox-gold-glow': chrome.goldGlow,
          // v2.6.0：表面材质配方变量（.pbox-glass/.pbox-sheen/.pbox-grain 消费）
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
          '--pbox-grain-opacity': String(m.grainOpacity)
        },
        ...(glassOn ? (makeGlassExtra(s, chrome).global as Record<string, unknown>) : {})
      }
    }
  }

  return extendTheme(config) as unknown as Theme
}
