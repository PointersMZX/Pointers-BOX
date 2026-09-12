import { Box, Flex, Text } from '@chakra-ui/react'
import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type TouchEvent as ReactTouchEvent
} from 'react'
import { FiRefreshCw } from 'react-icons/fi'
import { canStartPull, dampedPull, shouldTakeOverGesture } from '../utils/ptrGesture'

interface Props {
  /** 下拉刷新回调（异步）；完成后自动收起指示器 */
  onRefresh: () => Promise<void> | void
  children: ReactNode
}

type Phase = 'idle' | 'pulling' | 'loading' | 'rippling'

const THRESHOLD = 72 // 触发刷新的下拉距离
const START_AT = 10 // 接管手势前的容忍位移（小于它视为点击/轻扫）
const RESIST = 0.55 // 阻尼系数（跟手但带阻力）

/**
 * 液态玻璃下拉刷新（v2.1.0 重写）：
 * 1. 手势只能从空白区域发起（pointerdown 命中交互元素/资源卡片则不启动）——
 *    修复"下拉误触进入详情页"；
 * 2. 触摸端：下拉超过 START_AT 后 preventDefault 接管手势——
 *    修复 Android/触屏"拉不出来或来回弹"（原 touchAction:pan-y 被浏览器滚动接管后发出 pointercancel）；
 * 3. 指示器（玻璃圆盘）住进下拉出来的空白区域顶部，内容跟随下拉平滑回弹（高阻尼，无过冲晃动）。
 */
export default function GlassPullRefresh({ onRefresh, children }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const phaseRef = useRef<Phase>('idle')
  const startYRef = useRef(0)
  const pullingRef = useRef(false)
  const suppressClickRef = useRef(false)
  const [phase, setPhase] = useState<Phase>('idle')

  const pull = useMotionValue(0)
  const discScale = useTransform(pull, [0, THRESHOLD, 130], [0.6, 1, 1.06])
  const discOpacity = useTransform(pull, [6, 36], [0, 1])
  const contentY = useTransform(pull, (v) => v * 0.5)

  const setPhaseSafe = (p: Phase): void => {
    phaseRef.current = p
    setPhase(p)
  }

  const finishRefresh = useCallback((): void => {
    setPhaseSafe('rippling')
    window.setTimeout(() => {
      animate(pull, 0, { type: 'spring', stiffness: 320, damping: 30 })
      window.setTimeout(() => setPhaseSafe('idle'), 300)
    }, 380)
  }, [pull])

  // 各分支统一回弹（收敛：高阻尼，不产生来回晃动）
  const springBack = useCallback((): void => {
    animate(pull, 0, { type: 'spring', stiffness: 340, damping: 28 })
  }, [pull])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (phaseRef.current === 'loading' || phaseRef.current === 'rippling') return
    const el = containerRef.current
    if (!el || el.scrollTop > 0) return
    // v2.1.0：仅空白区域可作为手势起点（命中按钮/卡片/链接则让点击正常工作）
    if (!canStartPull(e.target)) return
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
        springBack()
      }
      return
    }
    if (raw > START_AT) {
      suppressClickRef.current = true
      if (containerRef.current) containerRef.current.style.overflow = 'hidden'
      phaseRef.current = 'pulling'
      setPhase('pulling')
      pull.set(dampedPull(raw, RESIST))
    }
  }

  const onPointerUp = (): void => {
    if (!pullingRef.current) return
    pullingRef.current = false
    if (containerRef.current) containerRef.current.style.overflow = 'auto'
    if (pull.get() >= THRESHOLD) {
      setPhaseSafe('loading')
      animate(pull, THRESHOLD, { type: 'spring', stiffness: 380, damping: 30 })
      Promise.resolve(onRefresh())
        .catch(() => {})
        .then(() => finishRefresh())
    } else {
      setPhaseSafe('idle')
      springBack()
    }
    // v2.1.0：所有分支结束都复位误触抑制标记（原实现只在下一次 click 时消费，存在漏吞一次点击的窗口）
    if (phaseRef.current === 'idle') window.setTimeout(() => { suppressClickRef.current = false }, 0)
  }

  // 触摸端手势接管：scrollTop 到顶后向下移动 → preventDefault 阻止浏览器滚动/回弹抢占
  // （React 合成事件默认 passive，需在容器上原生绑定 non-passive listener，见下方 useEffect）
  const onTouchMoveRef = useRef<(e: TouchEvent) => void>(() => {})
  onTouchMoveRef.current = (e: TouchEvent): void => {
    if (!pullingRef.current || phaseRef.current !== 'pulling') return
    const el = containerRef.current
    if (!el) return
    const t = e.touches[0]
    if (!t) return
    const raw = t.clientY - startYRef.current
    if (shouldTakeOverGesture(el.scrollTop, raw, START_AT)) {
      e.preventDefault()
    }
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onNativeTouchMove = (e: TouchEvent): void => onTouchMoveRef.current(e)
    // non-passive：允许 preventDefault（Chrome 56+ 对 touchmove 默认 passive）
    el.addEventListener('touchmove', onNativeTouchMove, { passive: false })
    return () => el.removeEventListener('touchmove', onNativeTouchMove)
  }, [])

  // 抑制下拉后的误触点击（capture 阶段拦截一次）
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
        : phase === 'pulling' && pull.get() >= THRESHOLD
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
      style={{ overscrollBehavior: 'contain' }}
    >
      {/* 玻璃圆盘指示器：住进下拉出来的空白区域顶部 */}
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

      {/* 列表内容（跟随下拉 / 平滑归位） */}
      <motion.div style={{ y: contentY }}>{children}</motion.div>
    </Box>
  )
}
