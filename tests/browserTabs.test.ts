import { DEFAULT_START_URL } from '../src/shared/browser'
import {
  useBrowserStore,
  getActiveTab,
  shouldSleepTab
} from '../src/renderer/src/store/browserStore'

describe('浏览器多标签状态机（v2.0.0）', () => {
  beforeEach(() => {
    // 重置为单标签初始态（id 动态生成，不硬编码）
    useBrowserStore.setState({
      tabs: [{ id: 't0', url: DEFAULT_START_URL, title: '新标签页', lastActiveAt: 0 }],
      activeId: 't0'
    })
  })

  it('navigateTo 更新活动标签 URL，不影响其他标签', () => {
    useBrowserStore.getState().newTab()
    const firstId = useBrowserStore.getState().tabs[0]!.id
    useBrowserStore.getState().setActive(firstId)
    useBrowserStore.getState().navigateTo('https://a.example.com')
    const { tabs, activeId } = useBrowserStore.getState()
    expect(activeId).toBe(firstId)
    expect(tabs.find((t) => t.id === activeId)?.url).toBe('https://a.example.com')
    expect(tabs.find((t) => t.id !== activeId)?.url).toBe(DEFAULT_START_URL)
  })

  it('newTab 追加并激活新标签', () => {
    useBrowserStore.getState().newTab()
    const { tabs, activeId } = useBrowserStore.getState()
    expect(tabs).toHaveLength(2)
    expect(activeId).toBe(tabs[1]!.id)
    expect(tabs[1]!.url).toBe(DEFAULT_START_URL)
  })

  it('closeTab 关闭活动标签后激活相邻标签', () => {
    useBrowserStore.getState().newTab() // [t0, n1] active=n1
    useBrowserStore.getState().newTab() // [t0, n1, n2] active=n2
    const { tabs, activeId } = useBrowserStore.getState()
    useBrowserStore.getState().closeTab(activeId)
    const after = useBrowserStore.getState()
    expect(after.tabs.map((t) => t.id)).toEqual(tabs.filter((t) => t.id !== activeId).map((t) => t.id))
    expect(after.activeId).toBe(tabs[1]!.id)
  })

  it('closeTab 关闭非活动标签不影响 activeId', () => {
    useBrowserStore.getState().newTab()
    const { activeId } = useBrowserStore.getState()
    useBrowserStore.getState().closeTab('t0')
    const { tabs, activeId: a2 } = useBrowserStore.getState()
    expect(tabs).toHaveLength(1)
    expect(a2).toBe(activeId)
  })

  it('关闭最后一个标签自动新建空白标签', () => {
    useBrowserStore.getState().closeTab('t0')
    const { tabs, activeId } = useBrowserStore.getState()
    expect(tabs).toHaveLength(1)
    expect(tabs[0]!.url).toBe(DEFAULT_START_URL)
    expect(activeId).toBe(tabs[0]!.id)
  })

  it('reorderTabs 拖拽排序且非法索引不动', () => {
    useBrowserStore.getState().newTab()
    useBrowserStore.getState().newTab()
    const ids1 = useBrowserStore.getState().tabs.map((t) => t.id)
    useBrowserStore.getState().reorderTabs(0, 2)
    const ids2 = useBrowserStore.getState().tabs.map((t) => t.id)
    expect(ids2).toEqual([ids1[1], ids1[2], ids1[0]])
    useBrowserStore.getState().reorderTabs(1, 99)
    expect(useBrowserStore.getState().tabs.map((t) => t.id)).toEqual(ids2)
  })

  it('resetAllTabs 全部回起始页', () => {
    useBrowserStore.getState().newTab('https://x.example.com')
    useBrowserStore.getState().resetAllTabs()
    expect(useBrowserStore.getState().tabs.every((t) => t.url === DEFAULT_START_URL)).toBe(true)
  })

  it('getActiveTab 兜底第一个标签', () => {
    const s = useBrowserStore.getState()
    expect(getActiveTab(s).id).toBe(s.activeId)
    expect(
      getActiveTab({ tabs: [{ id: 'x', url: 'u', title: 'x', lastActiveAt: 0 }], activeId: 'missing' }).id
    ).toBe('x')
  })
})

describe('后台标签闲置休眠（v2.1.0）', () => {
  const NOW = 1_700_000_000_000
  const MIN = 60_000

  it('sleepMinutes = 0 表示永不休眠', () => {
    expect(shouldSleepTab({ id: 'bg', lastActiveAt: NOW - 99 * MIN }, 'fg', 0, NOW)).toBe(false)
  })

  it('活动标签永不休眠', () => {
    expect(shouldSleepTab({ id: 'fg', lastActiveAt: 0 }, 'fg', 5, NOW)).toBe(false)
  })

  it('后台标签闲置超过时限休眠；未超过保持唤醒', () => {
    expect(shouldSleepTab({ id: 'bg', lastActiveAt: NOW - 6 * MIN }, 'fg', 5, NOW)).toBe(true)
    expect(shouldSleepTab({ id: 'bg', lastActiveAt: NOW - 4 * MIN }, 'fg', 5, NOW)).toBe(false)
    expect(shouldSleepTab({ id: 'bg', lastActiveAt: NOW - 5 * MIN }, 'fg', 5, NOW)).toBe(true) // 恰好到点
  })

  it('setActive 切换后新活动标签时间戳刷新，原活动标签进入休眠倒计时', () => {
    useBrowserStore.setState({
      tabs: [
        { id: 'a', url: DEFAULT_START_URL, title: 'a', lastActiveAt: NOW },
        { id: 'b', url: DEFAULT_START_URL, title: 'b', lastActiveAt: NOW }
      ],
      activeId: 'a'
    })
    useBrowserStore.getState().setActive('b')
    const { tabs, activeId } = useBrowserStore.getState()
    expect(activeId).toBe('b')
    expect(tabs.find((t) => t.id === 'b')!.lastActiveAt).toBeGreaterThanOrEqual(NOW)
    // 同一标签重复 setActive 不重复刷新（幂等）
    const before = tabs.find((t) => t.id === 'b')!.lastActiveAt
    useBrowserStore.getState().setActive('b')
    expect(useBrowserStore.getState().tabs.find((t) => t.id === 'b')!.lastActiveAt).toBe(before)
  })
})
