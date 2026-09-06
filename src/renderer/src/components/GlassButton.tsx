import { Box } from '@chakra-ui/react'
import { motion } from 'framer-motion'
import { useRef, useState, type ReactNode, type MouseEvent } from 'react'

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

interface Ripple {
  id: number
  x: number
  y: number
  size: number
}

let rippleSeq = 0

/**
 * 液态玻璃按钮（v2.0.0）：
 * 按下整体内缩 8% + 边缘泛起圆形透明扩散波纹；抬手弹性回弹过冲 ~1.03x 后归位（果冻阻尼 0.25s）。
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
  const [ripples, setRipples] = useState<Ripple[]>([])
  const ref = useRef<HTMLButtonElement>(null)

  const spawnRipple = (e: MouseEvent<HTMLButtonElement>): void => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const size = Math.max(rect.width, rect.height) * 1.2
    const id = ++rippleSeq
    setRipples((rs) => [...rs.slice(-3), { id, x, y, size }])
  }

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
      ref={ref}
      type="button"
      aria-label={ariaLabel}
      title={title}
      disabled={isDisabled}
      whileTap={isDisabled ? undefined : { scale: 0.92 }}
      whileHover={isDisabled ? undefined : { scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 480, damping: 15, mass: 0.9 }}
      onClick={(e) => {
        if (isDisabled) return
        spawnRipple(e)
        onClick?.()
      }}
      style={{
        position: 'relative',
        overflow: 'hidden',
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
        boxShadow:
          variant === 'primary' ? '0 4px 18px var(--pbox-accent-soft, rgba(159,122,234,0.35))' : 'none'
      }}
    >
      <Box as="span" display="inline-flex" alignItems="center" gap={2} position="relative" zIndex={1}>
        {children}
      </Box>
      {ripples.map((r) => (
        <Box
          key={r.id}
          className="pbox-press-ripple"
          style={{
            left: r.x - r.size / 2,
            top: r.y - r.size / 2,
            width: r.size,
            height: r.size
          }}
          onAnimationEnd={() => setRipples((rs) => rs.filter((x) => x.id !== r.id))}
        />
      ))}
    </motion.button>
  )
}
