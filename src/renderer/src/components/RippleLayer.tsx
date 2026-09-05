import { Box } from '@chakra-ui/react'
import { useEffect, useState } from 'react'

interface Ripple {
  id: number
  x: number
  y: number
}

let seq = 0

// 波浪扩散点击效果：pointer-events:none 纯视觉层，不拦截任何交互（不影响功能）
export default function RippleLayer() {
  const [ripples, setRipples] = useState<Ripple[]>([])

  useEffect(() => {
    const onDown = (e: PointerEvent): void => {
      const id = ++seq
      setRipples((prev) => [...prev.slice(-6), { id, x: e.clientX, y: e.clientY }])
      window.setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id))
      }, 950)
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [])

  return (
    <Box
      position="fixed"
      inset={0}
      pointerEvents="none"
      zIndex={9999}
      overflow="hidden"
      aria-hidden
    >
      {ripples.map((r) => (
        <Box
          key={r.id}
          position="absolute"
          left={r.x - 130}
          top={r.y - 130}
          width="260px"
          height="260px"
          borderRadius="full"
          style={{
            background:
              'radial-gradient(circle, var(--pbox-accent) 0%, transparent 62%)',
            animation: 'pboxRipple .9s cubic-bezier(.22,.61,.36,1) both',
            filter: 'blur(0.5px)'
          }}
        />
      ))}
    </Box>
  )
}
