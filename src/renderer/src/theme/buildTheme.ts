// 三套外观主题（液态玻璃/纯黑/纯白）—— 仅改变外观，不含任何功能逻辑
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
}

const SURFACES: Record<ThemeKey, SurfaceTokens> = {
  glass: {
    colorMode: 'dark',
    appBg: 'transparent',
    panel: 'rgba(255,255,255,0.08)',
    panelStrong: 'rgba(255,255,255,0.13)',
    border: 'rgba(255,255,255,0.16)',
    hover: 'rgba(255,255,255,0.10)',
    sidebar: 'rgba(10,20,40,0.32)',
    bar: 'rgba(8,16,32,0.38)',
    textPrimary: 'gray.50',
    textMuted: 'gray.300',
    inputBg: 'rgba(255,255,255,0.10)'
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
    inputBg: '#111111'
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
    inputBg: '#ffffff'
  }
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
      // v2.1.0：统一平滑过渡（替代过冲贝塞尔，观感更沉稳）
      '.chakra-button, a, [role="button"]': {
        transition: 'color .18s ease, background-color .18s ease, border-color .18s ease, opacity .18s ease'
      },
      // 形变微动效（悬停轻微上浮，无圆角形变）
      '.pbox-morph': {
        transition:
          'transform .22s ease-out, background-color .18s ease, border-color .18s ease'
      },
      '.pbox-morph:hover': {
        transform: 'translateY(-1px)'
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

// 液态玻璃独有的背景波浪色斑 + 各层次模糊
// v2.1.0：blur 110px→64px 降 GPU 负担；窗口隐藏/系统减少动效偏好时暂停漂移
function makeGlassExtra(effectiveAccent: string) {
  return {
    global: {
      '.pbox-blob': {
        position: 'fixed',
        pointerEvents: 'none',
        borderRadius: '9999px',
        filter: 'blur(64px)',
        opacity: '0.5',
        zIndex: 0,
        animation: 'pboxDrift 18s ease-in-out infinite alternate'
      },
      '.pbox-blob.b1': {
        width: '46vw',
        height: '46vw',
        left: '-10vw',
        top: '-14vw',
        background: `radial-gradient(circle, ${effectiveAccent} 0%, transparent 70%)`
      },
      '.pbox-blob.b2': {
        width: '40vw',
        height: '40vw',
        right: '-10vw',
        bottom: '-12vw',
        background: 'radial-gradient(circle, #7c5cff 0%, transparent 70%)',
        animationDelay: '-7s',
        animationDirection: 'alternate-reverse'
      },
      '.pbox-blob.b3': {
        width: '30vw',
        height: '30vw',
        left: '38vw',
        bottom: '2vw',
        background: 'radial-gradient(circle, #c084fc 0%, transparent 70%)',
        animationDelay: '-13s'
      },
      // v2.1.0：窗口隐藏到托盘时暂停漂移动画（后台 0 GPU 占用）
      'body.pbox-bg-paused .pbox-blob': {
        animationPlayState: 'paused'
      },
      // 系统级"减少动效"偏好：停止漂移
      '@media (prefers-reduced-motion: reduce)': {
        '.pbox-blob': {
          animation: 'none'
        }
      },
      '.pbox-blur-sidebar': {
        backdropFilter: 'blur(26px) saturate(150%)',
        WebkitBackdropFilter: 'blur(26px) saturate(150%)'
      },
      '.pbox-blur-panel': {
        backdropFilter: 'blur(14px) saturate(130%)',
        WebkitBackdropFilter: 'blur(14px) saturate(130%)'
      },
      '.pbox-blur-bar': {
        backdropFilter: 'blur(20px) saturate(140%)',
        WebkitBackdropFilter: 'blur(20px) saturate(140%)'
      },
      '@keyframes pboxDrift': {
        '0%': { transform: 'translate(0, 0) scale(1)' },
        '50%': { transform: 'translate(6vw, 4vh) scale(1.12)' },
        '100%': { transform: 'translate(-4vw, 6vh) scale(0.94)' }
      }
    }
  }
}

// 主题工厂：accent 仅液态玻璃主题可自定义，其余固定默认色
// Chakra v2 返回 Theme；本函数额外注入 semanticTokens/global keyframes/blur tokens 等扩展。
// 合并时以对象展开方式绕过 strict 约束；运行时完全兼容 Theme 接口。
export function buildTheme(themeKey: ThemeKey, accent: string): Theme {
  const s = SURFACES[themeKey]
  const effectiveAccent = themeKey === 'glass' ? accent : DEFAULT_ACCENT
  const isGlass = themeKey === 'glass'

  const baseStyles = makeStyles(effectiveAccent)
  const bodyBg = isGlass ? 'transparent' : s.appBg
  const bodyOverride = { body: { overflow: 'hidden', background: bodyBg } }

  // 二次 extendTheme 将液态玻璃额外样式叠加
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
      global: isGlass
        ? { ...baseStyles.global, ...bodyOverride, ...(makeGlassExtra(effectiveAccent).global as Record<string, unknown>) }
        : { ...baseStyles.global, ...bodyOverride }
    }
  }

  return extendTheme(config) as unknown as Theme
}
