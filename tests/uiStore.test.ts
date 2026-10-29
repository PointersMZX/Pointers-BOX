import { useUiStore } from '../src/renderer/src/store/uiStore'

describe('UI 路由仓库（PRD 2.3 + 平台页面集）', () => {
  // 每个用例前重置
  beforeEach(() => {
    useUiStore.setState({ page: 'home', platform: 'desktop', versionLogsDeepLink: false })
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

  it('Android 平台可切换到其全部可见页（v2.5.0 恢复 6 页含下载）', () => {
    useUiStore.getState().setPlatform('android')
    const { setPage } = useUiStore.getState()
    for (const p of ['library', 'browser', 'downloads', 'settings', 'home'] as const) {
      setPage(p)
      expect(useUiStore.getState().page).toBe(p)
    }
  })

  it('切回桌面平台时页面保留（可见页在两端均保留）', () => {
    useUiStore.getState().setPlatform('android')
    useUiStore.getState().setPage('browser')
    useUiStore.getState().setPlatform('desktop')
    expect(useUiStore.getState().page).toBe('browser')
  })

  // v2.3.2：首页「版本日志·全部」深链——置位 + 跳设置页；消费后回落到手动默认态
  it('goToVersionLogs 置深链并跳设置页，consume 清除', () => {
    const s = useUiStore.getState()
    s.goToVersionLogs()
    expect(useUiStore.getState().page).toBe('settings')
    expect(useUiStore.getState().versionLogsDeepLink).toBe(true)
    useUiStore.getState().consumeVersionLogsDeepLink()
    expect(useUiStore.getState().versionLogsDeepLink).toBe(false)
  })

  it('Android 平台深链同样生效（settings 两端可见）', () => {
    useUiStore.getState().setPlatform('android')
    useUiStore.getState().goToVersionLogs()
    expect(useUiStore.getState().page).toBe('settings')
    expect(useUiStore.getState().versionLogsDeepLink).toBe(true)
  })
})
