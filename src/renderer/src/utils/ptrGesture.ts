// 下拉刷新手势判定纯函数（v2.1.0）：
// 规则——手势只能从"空白区域"发起（不命中任何交互元素），
// 下拉出来的空白里放刷新指示器（刷新球），解决"误触进详情页"问题。
export const PTR_NO_PULL_SELECTOR = 'a, button, input, textarea, select, label, [role="button"], [role="menuitem"], [data-no-ptr]'

/** pointerdown 的 target 是否允许作为下拉刷新手势起点（空白区域 = true） */
// duck-typing：DOM 元素必有 closest（node 测试环境无全局 Element，用特征判断）
function hasClosest(target: EventTarget | null): target is EventTarget & { closest(s: string): unknown } {
  return target !== null && typeof (target as { closest?: unknown }).closest === 'function'
}

export function canStartPull(target: EventTarget | null, selector = PTR_NO_PULL_SELECTOR): boolean {
  if (!hasClosest(target)) return true
  if (target.closest(selector)) return false
  return true
}

/** 下拉手势是否应被接管（scrollTop 已到顶 + 向下位移超过启动阈值） */
export function shouldTakeOverGesture(
  scrollTop: number,
  deltaY: number,
  startThreshold = 10
): boolean {
  return scrollTop <= 0 && deltaY > startThreshold
}

/** 下拉位移 → 阻尼后的拉动距离（跟手但有阻力，越拉越费劲） */
export function dampedPull(deltaY: number, resist = 0.55, maxPull = 130): number {
  if (deltaY <= 0) return 0
  return Math.min(deltaY * resist, maxPull)
}
