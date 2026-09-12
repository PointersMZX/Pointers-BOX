import { normalizeConfig } from '../src/shared/config'

describe('配置归一化（PRD 4.4 下载路径/Android 浏览器选项 + 主题外观 + v2.0.0 收藏/历史）', () => {
  const defDir = 'C:\\Users\\u\\Downloads'
  const defaults = {
    downloadDir: defDir,
    androidBrowser: 'builtin' as const,
    theme: 'glass' as const,
    accent: '#9f7aea',
    favorites: [],
    keepDownloadHistory: false,
    tabSleepMinutes: 5
  }

  it('空/损坏配置回退默认值（默认液态玻璃主题）', () => {
    expect(normalizeConfig(null, defDir)).toEqual(defaults)
    expect(normalizeConfig(undefined, defDir)).toEqual(defaults)
    expect(normalizeConfig('garbage', defDir)).toEqual(defaults)
    expect(normalizeConfig({}, defDir)).toEqual(defaults)
  })

  it('合法值被保留', () => {
    expect(
      normalizeConfig(
        {
          downloadDir: 'D:\\dd',
          androidBrowser: 'system',
          theme: 'black',
          accent: '#ff8800',
          favorites: ['1', 2, '1'],
          keepDownloadHistory: true
        },
        defDir
      )
    ).toEqual({
      downloadDir: 'D:\\dd',
      androidBrowser: 'system',
      theme: 'black',
      accent: '#ff8800',
      favorites: ['1', '2'],
      keepDownloadHistory: true,
      tabSleepMinutes: 5
    })
  })

  it('非法值被纠正：空路径回退、浏览器枚举外回退 builtin、主题/颜色非法回退默认', () => {
    expect(normalizeConfig({ downloadDir: '   ' }, defDir).downloadDir).toBe(defDir)
    expect(normalizeConfig({ androidBrowser: 'ie' }, defDir).androidBrowser).toBe('builtin')
    expect(normalizeConfig({ theme: 'neon' }, defDir).theme).toBe('glass')
    expect(normalizeConfig({ accent: 'not-a-color' }, defDir).accent).toBe('#9f7aea')
  })

  it('v2.0.0：favorites 非数组回退空、数字 id 字符串化去重、history 开关仅 true 生效', () => {
    expect(normalizeConfig({ favorites: 'bad' }, defDir).favorites).toEqual([])
    expect(normalizeConfig({ favorites: [3, '3', 'x'] }, defDir).favorites).toEqual(['3', 'x'])
    expect(normalizeConfig({ keepDownloadHistory: 'yes' }, defDir).keepDownloadHistory).toBe(false)
    expect(normalizeConfig({ keepDownloadHistory: true }, defDir).keepDownloadHistory).toBe(true)
  })

  it('v2.1.0：updateChannel 未选为 undefined、合法值保留、非法值回 undefined（触发首启弹窗）', () => {
    expect(normalizeConfig({}, defDir).updateChannel).toBeUndefined()
    expect(normalizeConfig({ updateChannel: 'gitee' }, defDir).updateChannel).toBe('gitee')
    expect(normalizeConfig({ updateChannel: 'github' }, defDir).updateChannel).toBe('github')
    expect(normalizeConfig({ updateChannel: 'gitlab' }, defDir).updateChannel).toBeUndefined()
  })

  it('v2.1.0：tabSleepMinutes 默认 5、0 表示永不休眠、非法值回退 5', () => {
    expect(normalizeConfig({}, defDir).tabSleepMinutes).toBe(5)
    expect(normalizeConfig({ tabSleepMinutes: 0 }, defDir).tabSleepMinutes).toBe(0)
    expect(normalizeConfig({ tabSleepMinutes: 15 }, defDir).tabSleepMinutes).toBe(15)
    expect(normalizeConfig({ tabSleepMinutes: -3 }, defDir).tabSleepMinutes).toBe(5)
    expect(normalizeConfig({ tabSleepMinutes: 'x' }, defDir).tabSleepMinutes).toBe(5)
  })
})
