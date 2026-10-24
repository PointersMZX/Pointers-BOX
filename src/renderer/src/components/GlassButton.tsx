import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { SPRING } from '../theme/motion'

interface Props {
  children: ReactNode
  onClick?: () => void
  /** primary = 强调色实心；ghost = 玻璃描边 */
  variant?: 'primary' | 'ghost'
  size?: 'sm' | 'md'
  isDisabled?: boolean
  ariaLabel?: string
  title?: string
}

/**
 * 液态玻璃按钮（v2.1.0 克制版 → v2.4.0 胶囊提档）：
 * 按压弹簧内缩回弹；悬停时胶囊内一道流光扫过（.pbox-glint-layer::after，buildTheme 全局 CSS），
 * 玻璃"液面"观感。overflow 收在内部 glint 层，外阴影不被裁。
 */
export default function GlassButton({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  isDisabled = false,
  ariaLabel,
  title
}: Props) {
  const pad = size === 'sm' ? '0.4rem 0.95rem' : '0.55rem 1.25rem'
  const fontSize = size === 'sm' ? '0.8rem' : '0.88rem'
  const bg = variant === 'primary' ? 'var(--pbox-accent)' : 'var(--chakra-colors-pinput, rgba(255,255,255,0.10))'
  const color = variant === 'primary' ? '#ffffff' : 'var(--chakra-colors-ptext, inherit)'
  const border =
    variant === 'primary'
      ? '1px solid transparent'
      : '1px solid var(--chakra-colors-pborder, rgba(255,255,255,0.16))'

  return (
    <motion.button
      type="button"
      aria-label={ariaLabel}
      title={title}
      disabled={isDisabled}
      whileTap={isDisabled ? undefined : { scale: 0.94 }}
      transition={{ ...SPRING.press }}
      onClick={() => {
        if (isDisabled) return
        onClick?.()
      }}
      className="pbox-glint"
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.4rem',
        padding: pad,
        fontSize,
        fontWeight: 600,
        lineHeight: 1.3,
        borderRadius: '9999px',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        background: bg,
        color,
        border,
        opacity: isDisabled ? 0.5 : 1,
        WebkitBackdropFilter: 'blur(12px)',
        backdropFilter: 'blur(12px)',
        // v2.4.0：顶部内缘发丝（玻璃"液面"上缘高光）
        boxShadow:
          variant === 'primary'
            ? '0 4px 18px var(--pbox-accent-soft, rgba(124,92,255,0.35)), inset 0 1px 0 rgba(255,255,255,0.22)'
            : 'inset 0 1px 0 rgba(255,255,255,0.14)'
      }}
    >
      <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
        {children}
      </span>
      {/* 流光层：绝对铺满 + 内裁圆角，::after 扫光（见 buildTheme .pbox-glint-layer） */}
      <span aria-hidden className="pbox-glint-layer" />
    </motion.button>
  )
}
