import { Box, Flex, Text } from '@chakra-ui/react'
import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode
} from 'react'
import { FiRefreshCw } from 'react-icons/fi'

interface Props {
  /** 下拉刷新回调（异步）；完成后自动播放回弹与波纹动画 */
  onRefresh: () => Promise<void> | void
  children: ReactNode
}

type Phase = 'idle' | 'pulling' | 'loading' | 'rippling'

const THRESHOLD = 72 // 触发刷新的下拉距离
const MAX_PULL = 130 // 最大下拉距离
const RESIST = 0.55 // 阻尼系数（跟手但带阻力）

/**
 * 液态玻璃下拉刷新（v2.0.0，iOS 交互逻辑）：
 * 1. 下拉过程：玻璃圆盘跟随下拉距离逐步放大，同时玻璃形变越拉越扁（scaleX↑ scaleY↓），流动高光持续；
 * 2. 松手未达阈值：玻璃圆盘弹性收缩回初始位置，形变还原带轻微阻尼晃动；
 * 3. 松手达阈值：保持形变等待刷新；刷新成功后圆盘带弹性向上回弹 + 表面扩散波纹 + 整体收缩消失，
 *    列表整体弹性下拉归位。
 */
export default function GlassPullRefresh({ onRefresh, children }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const phaseRef = useRef<Phase>('idle')
  const startYRef = useRef(0)
  const pullingRef = useRef(false)
  const suppressClickRef = useRef(false)
  const [phase, setPhase] = useState<Phase>('idle')

  const pull = useMotionValue(0)
  // 玻璃圆盘：放大 + 拉扁形变
  const discScale = useTransform(pull, [0, THRESHOLD, MAX_PULL], [0.5, 1, 1.12])
  const discSx = useTransform(pull, [0, THRESHOLD, MAX_PULL], [1, 1.1, 1.22])
  const discSy = useTransform(pull, [0, THRESHOLD, MAX_PULL], [1, 0.85, 0.72])
  const discOpacity = useTransform(pull, [6, 36], [0, 1])
  // 列表内容跟随下拉（归位时由弹簧驱动）
  const contentY = useTransform(pull, (v) => v * 0.5)

  const setPhaseSafe = (p: Phase): void => {
    phaseRef.current = p
    setPhase(p)
  }

  const finishRefresh = useCallback((): void => {
    // 波纹扩散
    setPhaseSafe('rippling')
    window.setTimeout(() => {
      // 圆盘弹性收缩消失（向上回弹 + 缩放归零）
      animate(pull, 0, { type: 'spring', stiffness: 320, damping: 20 })
      window.setTimeout(() => setPhaseSafe('idle'), 320)
    }, 420)
  }, [pull])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (phaseRef.current === 'loading' || phaseRef.current === 'rippling') return
    const el = containerRef.current
    if (!el || el.scrollTop > 0) return
    startYRef.current = e.clientY
    pullingRef.current = true
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!pullingRef.current) return
    if (phaseRef.current === 'loading' || phaseRef.current === 'rippling') return
    const raw = e.clientY - startYRef.current
    if (raw <= 0) {
      if (phaseRef.current === 'pulling') {
        phaseRef.current = 'idle'
        setPhase('idle')
        animate(pull, 0, { type: 'spring', stiffness: 340, damping: 16 })
      }
      return
    }
    // 下拉中：跟手 + 阻尼；超过阈值阻止页面滚动/点击
    if (raw > 6) suppressClickRef.current = true
    if (containerRef.current) containerRef.current.style.overflow = 'hidden'
    phaseRef.current = 'pulling'
    setPhase('pulling')
    pull.set(Math.min(raw * RESIST, MAX_PULL))
  }

  const onPointerUp = (): void => {
    if (!pullingRef.current) return
    pullingRef.current = false
    if (containerRef.current) containerRef.current.style.overflow = 'auto'
    const current = pull.get()
    if (current >= THRESHOLD) {
      // 保持形变等待刷新
      setPhaseSafe('loading')
      animate(pull, THRESHOLD, { type: 'spring', stiffness: 380, damping: 26 })
      Promise.resolve(onRefresh())
        .catch(() => {})
        .then(() => finishRefresh())
    } else {
      // 未达阈值：阻尼晃动回弹
      setPhaseSafe('idle')
      animate(pull, 0, { type: 'spring', stiffness: 300, damping: 15, mass: 0.9 })
    }
  }

  // 抑制拉动后的误触点击
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onClickCapture = (e: Event): void => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false
        e.preventDefault()
        e.stopPropagation()
      }
    }
    el.addEventListener('click', onClickCapture, true)
    return () => el.removeEventListener('click', onClickCapture, true)
  }, [])

  const label =
    phase === 'loading'
      ? '正在刷新…'
      : phase === 'rippling'
        ? '刷新完成'
        : pull.get() >= THRESHOLD || (phase === 'pulling' && pull.get() >= THRESHOLD)
          ? '松手刷新'
          : '下拉刷新'

  return (
    <Box
      ref={containerRef}
      position="relative"
      h="full"
      minH={0}
      overflowY="auto"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{ overscrollBehavior: 'contain', touchAction: 'pan-y' }}
    >
      {/* 玻璃圆盘指示器 */}
      <motion.div
        aria-hidden
        style={{
          position: 'absolute',
          top: 10,
          left: '50%',
          marginLeft: '-34px',
          width: '68px',
          height: '68px',
          zIndex: 20,
          y: pull,
          scale: discScale,
          scaleX: discSx,
          scaleY: discSy,
          opacity: discOpacity,
          pointerEvents: 'none'
        }}
      >
        <Box className="pbox-ptr-disc" w="68px" h="68px">
          {phase === 'loading' && <FiRefreshCw color="#e2e8f0" size={20} style={{ animation: 'spin 1s linear infinite' }} />}
        </Box>
        {phase === 'rippling' && <Box className="pbox-ptr-ring" />}
      </motion.div>

      {/* 状态文字 */}
      <motion.div
        aria-hidden
        style={{
          position: 'absolute',
          top: 46,
          left: 'calc(50% + 42px)',
          zIndex: 20,
          y: pull,
          opacity: discOpacity,
          pointerEvents: 'none'
        }}
      >
        <Text fontSize="xs" color="ptextmuted" whiteSpace="nowrap">
          {label}
        </Text>
      </motion.div>

      {/* 列表内容（跟随下拉 / 弹性归位） */}
      <motion.div style={{ y: contentY }}>{children}</motion.div>
    </Box>
  )
}
