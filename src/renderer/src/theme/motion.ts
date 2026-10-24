// v2.3.0 动效令牌：全应用统一的时长与缓动（克制、无过冲、旗舰手感）
// 所有交互动效从这里取值，禁止散落魔法数
// v2.4.0：胶囊液态玻璃配套——页面入场改弹簧轻弹（短程、高阻尼，仍有生命感但不过冲）

/** 时长（秒） */
export const DUR = {
  /** 微交互：按压、悬停、小控件 */
  fast: 0.12,
  /** 常规：页面淡入、卡片位移 */
  normal: 0.18,
  /** 慢速：大面积面板、首次呈现 */
  slow: 0.28
} as const

/** 缓动曲线 */
export const EASE = {
  /** 标准入场：快速起步、平缓收尾 */
  out: 'cubic-bezier(0.2, 0, 0, 1)',
  /** 标准退场 */
  in: 'cubic-bezier(0.4, 0, 1, 1)'
} as const

/** 弹簧预设（framer-motion）：轻弹入场 / 紧致按压 */
export const SPRING = {
  /** 页面/弹窗入场：轻弹，约 3% 过冲 */
  settle: { type: 'spring', stiffness: 420, damping: 34 } as const,
  /** 按压回弹：快而稳 */
  press: { type: 'spring', stiffness: 620, damping: 30 } as const
} as const

/** 页面切换（v2.4.0：弹簧轻弹入场——轻微下沉+缩放回正，有"落座"感） */
export const PAGE_ENTER = {
  opacity: 0,
  y: 18,
  scale: 0.985
} as const

export const PAGE_ENTER_ACTIVE = {
  opacity: 1,
  y: 0,
  scale: 1,
  transition: { ...SPRING.settle }
} as const
