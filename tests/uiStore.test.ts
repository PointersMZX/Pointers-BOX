import { useUiStore } from '../src/renderer/src/store/uiStore'

describe('UI 路由仓库（PRD 2.3 + 平台页面集）', () => {
  // 每个用例前重置
  beforeEach(() => {
    useUiStore.setState({ page: 'home', platform: 'desktop' })
  })

  it('默认在首页、桌面平台', () => {
    expect(useUiStore.getState().page).toBe('home')
    expect(useUiStore.getState().platform).toBe('desktop')
  })

  it('桌面端可切换到全部页面', () => {
    const { setPage } = useUiStore.getState()
    for (const p of ['library', 'downloads', 'browser', 'settings', 'home'] as const) {
      setPage(p)
      expect(useUiStore.getState().page).toBe(p)
    }
  })

  it('Android 平台同样可切换到全部页面（全功能集）', () => {
    useUiStore.getState().setPlatform('android')
    const { setPage } = useUiStore.getState()
    for (const p of ['library', 'browser', 'downloads', 'settings', 'home'] as const) {
      setPage(p)
      expect(useUiStore.getState().page).toBe(p)
    }
  })

  it('切回桌面平台时页面保留', () => {
    useUiStore.getState().setPlatform('android')
    useUiStore.getState().setPage('downloads')
    useUiStore.getState().setPlatform('desktop')
    expect(useUiStore.getState().page).toBe('downloads')
  })
})
