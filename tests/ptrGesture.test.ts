import { canStartPull, dampedPull, shouldTakeOverGesture } from '../src/renderer/src/utils/ptrGesture'

// 最小 Element mock：只实现 canStartPull 用到的 closest 能力
class FakeElement {
  readonly tagName: string
  private readonly attrs: Record<string, string | undefined>
  private readonly parent: FakeElement | null

  constructor(
    tagName: string,
    attrs: Record<string, string | undefined> = {},
    parent: FakeElement | null = null
  ) {
    this.tagName = tagName.toUpperCase()
    this.attrs = attrs
    this.parent = parent
  }

  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean {
    return false
  }

  closest(selector: string): FakeElement | null {
    // selector = 'a, button, input, ..., [role="button"], [data-no-ptr]'（ptrGesture 默认值）
    for (const sel of selector.split(',')) {
      const s = sel.trim()
      const tag = s.match(/^([a-z]+)$/i)?.[1]
      // 属性选择器：[attr] / [attr="value"] 两种形态（只关心属性存在）
      const attr = s.match(/^\[([a-z-]+)(?:="[^"]*")?\]$/i)?.[1]
      if (tag && this.tagName === tag.toUpperCase()) return this
      if (attr && this.attrs[attr] !== undefined) return this
    }
    return this.parent?.closest(selector) ?? null
  }
}

function el(tag: string, attrs: Record<string, string | undefined> = {}, parent: FakeElement | null = null): FakeElement {
  return new FakeElement(tag, attrs, parent)
}

describe('下拉刷新手势判定（v2.1.0）', () => {
  it('空白区域可作为手势起点；交互元素（button/a/input/menuitem/data-no-ptr）不可', () => {
    expect(canStartPull(el('div'))).toBe(true)
    expect(canStartPull(el('span'))).toBe(true)
    expect(canStartPull(el('button'))).toBe(false)
    expect(canStartPull(el('a'))).toBe(false)
    expect(canStartPull(el('input'))).toBe(false)
    expect(canStartPull(el('div', { role: 'button' }))).toBe(false)
    expect(canStartPull(el('div', { role: 'menuitem' }))).toBe(false)
    expect(canStartPull(el('div', { 'data-no-ptr': '' }))).toBe(false)
    // 交互元素的内层 span 也不可（closest 向上冒泡）
    const btn = el('button')
    const inner = el('span', {}, btn)
    expect(canStartPull(inner)).toBe(false)
    // 普通 div 内的 button：起点是 button 本身 → 不可
    expect(canStartPull(el('button', {}, el('div')))).toBe(false)
  })

  it('非 Element 目标（null/document）按空白处理', () => {
    expect(canStartPull(null)).toBe(true)
    expect(canStartPull({} as unknown as EventTarget)).toBe(true)
  })

  it('仅当滚动到顶且向下位移超过阈值时接管手势', () => {
    expect(shouldTakeOverGesture(0, 12)).toBe(true)
    expect(shouldTakeOverGesture(0, 5)).toBe(false)
    expect(shouldTakeOverGesture(40, 100)).toBe(false)
    expect(shouldTakeOverGesture(0, -20)).toBe(false)
  })

  it('下拉位移阻尼换算：负值归零、跟手×0.55、封顶 maxPull', () => {
    expect(dampedPull(-30)).toBe(0)
    expect(dampedPull(0)).toBe(0)
    expect(dampedPull(100)).toBeCloseTo(55)
    // 超过封顶（1000×0.55=550 > 130）
    expect(dampedPull(1000)).toBe(130)
    expect(dampedPull(100, 0.8, 200)).toBeCloseTo(80)
  })
})
