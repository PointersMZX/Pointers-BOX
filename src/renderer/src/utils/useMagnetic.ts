// v2.5.0 克制磁吸（液态玻璃动态层）：指针在元素附近时向指针方向轻微偏移（≤5px），
// 离开范围弹簧归位。弹簧手感取丝滑微弹档（06 号规范推荐 0.085/0.84 的 framer-motion 等效）。
// 仅桌面精确指针（hover:hover + pointer: fine）启用；触屏与系统"减少动效"自动不生效。
import { useSpring, type MotionStyle } from 'framer-motion'
import { useMotionValue } from 'framer-motion'
import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

export function useMagnetic<T extends HTMLElement = HTMLElement>(
  strength = 5,
  radius = 110
): {
  ref: RefObject<T | null>
  style: MotionStyle
} {
  const ref = useRef<T | null>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 300, damping: 28 })
  const sy = useSpring(y, { stiffness: 300, damping: 28 })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const onMove = (e: PointerEvent): void => {
      const r = el.getBoundingClientRect()
      const dx = e.clientX - (r.left + r.width / 2)
      const dy = e.clientY - (r.top + r.height / 2)
      const dist = Math.hypot(dx, dy)
      const reach = radius + Math.max(r.width, r.height) / 2
      if (dist < reach) {
        // 距离越近吸得越多，位移钳到 strength
        const pull = 1 - dist / reach
        const k = 0.24 * pull
        x.set(Math.max(-strength, Math.min(strength, dx * k)))
        y.set(Math.max(-strength, Math.min(strength, dy * k)))
      } else {
        x.set(0)
        y.set(0)
      }
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      x.set(0)
      y.set(0)
    }
  }, [strength, radius, x, y])

  return { ref, style: { x: sx, y: sy } }
}
