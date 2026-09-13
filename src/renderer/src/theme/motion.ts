// v2.3.0 动效令牌：全应用统一的时长与缓动（克制、无过冲、旗舰手感）
// 所有交互动效从这里取值，禁止散落魔法数

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

/** 页面切换（仅入场，无过冲） */
export const PAGE_ENTER = {
  opacity: 0,
  y: 6
} as const

export const PAGE_ENTER_ACTIVE = {
  opacity: 1,
  y: 0,
  transition: { duration: DUR.normal, ease: 'easeOut' }
} as const
