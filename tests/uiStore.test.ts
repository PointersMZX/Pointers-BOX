import { useUiStore } from '../src/renderer/src/store/uiStore'

describe('UI 路由仓库（PRD 2.3 + 平台裁剪）', () => {
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
    setPage('library')
    expect(useUiStore.getState().page).toBe('library')
    setPage('downloads')
    expect(useUiStore.getState().page).toBe('downloads')
    setPage('browser')
    expect(useUiStore.getState().page).toBe('browser')
    setPage('settings')
    expect(useUiStore.getState().page).toBe('settings')
    setPage('home')
    expect(useUiStore.getState().page).toBe('home')
  })

  it('Android 平台下禁止切换到隐藏页面', () => {
    useUiStore.getState().setPlatform('android')
    useUiStore.getState().setPage('downloads')
    expect(useUiStore.getState().page).toBe('home')
    useUiStore.getState().setPage('settings')
    expect(useUiStore.getState().page).toBe('settings')
  })

  it('切换平台时若当前页面不可见则回到首页', () => {
    useUiStore.getState().setPage('downloads')
    useUiStore.getState().setPlatform('android')
    expect(useUiStore.getState().page).toBe('home')
    useUiStore.getState().setPage('library')
    useUiStore.getState().setPlatform('desktop')
    expect(useUiStore.getState().page).toBe('library') // 可见页面保留
  })
})
