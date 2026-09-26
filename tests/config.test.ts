import { normalizeConfig } from '../src/shared/config'

describe('配置归一化（PRD 4.4 下载路径/Android 浏览器选项 + 主题外观 + v2.3.0 四主题/液态玻璃）', () => {
  const defDir = 'C:\\Users\\u\\Downloads'
  const defaults = {
    downloadDir: defDir,
    androidBrowser: 'system' as const,
    // v2.3.0：默认主题紫金黑
    theme: 'zj' as const,
    accent: '#7c5cff',
    favorites: [],
    keepDownloadHistory: false,
    tabSleepMinutes: 5,
    homeLayout: 'compact' as const,
    // v2.2.0：更新渠道默认兜底 gitee（首启不再强制弹窗）
    updateChannel: 'gitee' as const
  }

  it('空/损坏配置回退默认值（默认紫金黑主题）', () => {
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
          keepDownloadHistory: true,
          homeLayout: 'wide'
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
      tabSleepMinutes: 5,
      homeLayout: 'wide',
      // v2.2.0：updateChannel 默认兜底 gitee
      updateChannel: 'gitee'
    })
  })

  it('非法值被纠正：空路径回退、浏览器固定 system（v2.3.0 无内置）、主题/颜色非法回退默认', () => {
    expect(normalizeConfig({ downloadDir: '   ' }, defDir).downloadDir).toBe(defDir)
    expect(normalizeConfig({ androidBrowser: 'ie' }, defDir).androidBrowser).toBe('system')
    expect(normalizeConfig({ androidBrowser: 'builtin' }, defDir).androidBrowser).toBe('system')
    expect(normalizeConfig({ theme: 'neon' }, defDir).theme).toBe('zj')
    expect(normalizeConfig({ theme: 'glass' }, defDir).theme).toBe('custom') // v2.2.0 旧键迁移
    expect(normalizeConfig({ accent: 'not-a-color' }, defDir).accent).toBe('#7c5cff')
  })

  it('v2.3.0：液态玻璃按主题开关——合法布尔保留，zj 键剔除，非对象回退缺省', () => {
    // 未提供 = 无该键（各主题走自身默认）
    expect('liquidGlass' in normalizeConfig({}, defDir)).toBe(false)
    // 合法值保留（zj 锁死，配置被剔除）
    expect(normalizeConfig({ liquidGlass: { zj: false, custom: false, black: true, white: false } }, defDir).liquidGlass).toEqual({
      custom: false,
      black: true,
      white: false
    })
    // 仅 zj 键 = 全被剔除 → 无该键
    expect('liquidGlass' in normalizeConfig({ liquidGlass: { zj: false } }, defDir)).toBe(false)
    // 非法值（字符串/数组/非布尔）整块回退缺省
    expect('liquidGlass' in normalizeConfig({ liquidGlass: 'on' }, defDir)).toBe(false)
    expect('liquidGlass' in normalizeConfig({ liquidGlass: { black: 'yes' } }, defDir)).toBe(false)
  })

  it('v2.2.0 迁移：存档中的旧默认紫 #9f7aea 自动跟随新默认 #7c5cff', () => {
    expect(normalizeConfig({ accent: '#9f7aea' }, defDir).accent).toBe('#7c5cff')
    expect(normalizeConfig({ accent: '#9F7AEA' }, defDir).accent).toBe('#7c5cff')
    // 新默认本身的存档保持稳定
    expect(normalizeConfig({ accent: '#7c5cff' }, defDir).accent).toBe('#7c5cff')
    // 用户显式选择的其他颜色不受迁移影响
    expect(normalizeConfig({ accent: '#3182ce' }, defDir).accent).toBe('#3182ce')
  })

  it('v2.0.0：favorites 非数组回退空、数字 id 字符串化去重、history 开关仅 true 生效', () => {
    expect(normalizeConfig({ favorites: 'bad' }, defDir).favorites).toEqual([])
    expect(normalizeConfig({ favorites: [3, '3', 'x'] }, defDir).favorites).toEqual(['3', 'x'])
    expect(normalizeConfig({ keepDownloadHistory: 'yes' }, defDir).keepDownloadHistory).toBe(false)
    expect(normalizeConfig({ keepDownloadHistory: true }, defDir).keepDownloadHistory).toBe(true)
  })

  it('v2.2.0：updateChannel 默认 gitee；显式 null 清空为 undefined（触发首启弹窗）；合法值保留、非法回默认', () => {
    expect(normalizeConfig({}, defDir).updateChannel).toBe('gitee')
    expect(normalizeConfig({ updateChannel: 'gitee' }, defDir).updateChannel).toBe('gitee')
    expect(normalizeConfig({ updateChannel: 'github' }, defDir).updateChannel).toBe('github')
    // v2.2.0：默认值兜底 gitee，非法值不再回 undefined
    expect(normalizeConfig({ updateChannel: 'gitlab' }, defDir).updateChannel).toBe('gitee')
    // 显式清空（设置页写入 null）仍走首启弹窗
    expect(normalizeConfig({ updateChannel: null }, defDir).updateChannel).toBeUndefined()
  })

  it('v2.1.0：tabSleepMinutes 默认 5、0 表示永不休眠、非法值回退 5', () => {
    expect(normalizeConfig({}, defDir).tabSleepMinutes).toBe(5)
    expect(normalizeConfig({ tabSleepMinutes: 0 }, defDir).tabSleepMinutes).toBe(0)
    expect(normalizeConfig({ tabSleepMinutes: 15 }, defDir).tabSleepMinutes).toBe(15)
    expect(normalizeConfig({ tabSleepMinutes: -3 }, defDir).tabSleepMinutes).toBe(5)
    expect(normalizeConfig({ tabSleepMinutes: 'x' }, defDir).tabSleepMinutes).toBe(5)
  })

  it('v2.2.0：homeLayout 默认 compact、合法值保留、非法值回退 compact', () => {
    expect(normalizeConfig({}, defDir).homeLayout).toBe('compact')
    expect(normalizeConfig({ homeLayout: 'stacked' }, defDir).homeLayout).toBe('stacked')
    expect(normalizeConfig({ homeLayout: 'wide' }, defDir).homeLayout).toBe('wide')
    expect(normalizeConfig({ homeLayout: 'grid' }, defDir).homeLayout).toBe('compact')
    expect(normalizeConfig({ homeLayout: 12 }, defDir).homeLayout).toBe('compact')
  })
})
