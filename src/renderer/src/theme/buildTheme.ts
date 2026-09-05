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
      // 弹性回弹：交互元素统一过冲缓动
      '.chakra-button, a, [role="button"]': {
        transition: 'all .35s cubic-bezier(.34,1.56,.64,1)'
      },
      // 形变微动效（悬停轻微上浮缩放 + 圆角形变）
      '.pbox-morph': {
        transition:
          'border-radius .35s cubic-bezier(.34,1.56,.64,1), transform .35s cubic-bezier(.34,1.56,.64,1), background-color .25s ease, border-color .25s ease'
      },
      '.pbox-morph:hover': {
        transform: 'translateY(-2px) scale(1.012)',
        borderRadius: '18px'
      },
      // 脉动闪烁（强调按钮呼吸辉光）
      '.pbox-pulse': {
        animation: 'pboxPulse 2.6s ease-in-out infinite'
      },
      '@keyframes pboxPulse': {
        '0%,100%': { boxShadow: `0 0 0 0 ${hexToRgba(effectiveAccent, 0)}` },
        '50%': { boxShadow: `0 0 18px 4px ${hexToRgba(effectiveAccent, 0.35)}` }
      },
      '@keyframes pboxRipple': {
        from: { transform: 'scale(0)', opacity: '0.5' },
        to: { transform: 'scale(1)', opacity: '0' }
      }
    }
  }
}

// 液态玻璃独有的背景波浪色斑 + 各层次模糊（按层级 26px / 20px / 14px 递进，形成立体层次感）
function makeGlassExtra(effectiveAccent: string) {
  return {
    global: {
      '.pbox-blob': {
        position: 'fixed',
        pointerEvents: 'none',
        borderRadius: '9999px',
        filter: 'blur(110px)',
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
        background: 'radial-gradient(circle, #00b3a4 0%, transparent 70%)',
        animationDelay: '-13s'
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
