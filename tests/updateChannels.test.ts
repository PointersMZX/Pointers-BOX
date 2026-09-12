import {
  isUpdateChannel,
  matchAssetByName,
  normalizeTabSleepMinutes,
  normalizeUpdateChannel,
  winCompatFromOsVersion,
  UPDATE_CHANNEL_INFO,
  UPDATE_CHANNELS
} from '../src/shared/updateChannels'

describe('更新渠道归一化（v2.1.0）', () => {
  it('合法渠道保留，非法值回 undefined（触发首启弹窗）', () => {
    expect(normalizeUpdateChannel('gitee')).toBe('gitee')
    expect(normalizeUpdateChannel('github')).toBe('github')
    expect(normalizeUpdateChannel('mirror')).toBeUndefined()
    expect(normalizeUpdateChannel(undefined)).toBeUndefined()
    expect(normalizeUpdateChannel(null)).toBeUndefined()
    expect(normalizeUpdateChannel(42)).toBeUndefined()
  })

  it('isUpdateChannel 类型守卫', () => {
    expect(isUpdateChannel('gitee')).toBe(true)
    expect(isUpdateChannel('github')).toBe(true)
    expect(isUpdateChannel('gitlab')).toBe(false)
  })

  it('两个渠道的 API 与发布页 URL 均已定义', () => {
    expect(UPDATE_CHANNELS).toEqual(['gitee', 'github'])
    for (const ch of UPDATE_CHANNELS) {
      const info = UPDATE_CHANNEL_INFO[ch]
      expect(info.releaseApi).toMatch(/^https:\/\//)
      expect(info.releasePage).toMatch(/^https:\/\//)
    }
    expect(UPDATE_CHANNEL_INFO.github.releaseApi).toContain('api.github.com')
    expect(UPDATE_CHANNEL_INFO.gitee.releaseApi).toContain('gitee.com/api/v5')
  })
})

describe('标签休眠分钟数归一化（v2.1.0）', () => {
  it('合法值保留（含 0 = 永不）', () => {
    expect(normalizeTabSleepMinutes(0)).toBe(0)
    expect(normalizeTabSleepMinutes(5)).toBe(5)
    expect(normalizeTabSleepMinutes(15)).toBe(15)
  })

  it('非法/负数回退默认 5 分钟', () => {
    expect(normalizeTabSleepMinutes(-1)).toBe(5)
    expect(normalizeTabSleepMinutes('5')).toBe(5)
    expect(normalizeTabSleepMinutes(NaN)).toBe(5)
    expect(normalizeTabSleepMinutes(undefined)).toBe(5)
    expect(normalizeTabSleepMinutes(2.7)).toBe(2)
  })
})

describe('Windows 版本分流（v2.1.0）', () => {
  it('非 Windows 平台返回 null（Android/CI 用标准渠道）', () => {
    expect(winCompatFromOsVersion('linux', '6.5.0')).toBeNull()
    expect(winCompatFromOsVersion('darwin', '23.0.0')).toBeNull()
    expect(winCompatFromOsVersion('android', '14')).toBeNull()
  })

  it('按 build 号判定：Win10/11（≥10240）为 false，Win7/8 为 true', () => {
    expect(winCompatFromOsVersion('win32', '10.0.22000')).toBe(false) // Win11
    expect(winCompatFromOsVersion('win32', '10.0.19045')).toBe(false) // Win10 22H2
    expect(winCompatFromOsVersion('win32', '10.0.10240')).toBe(false) // Win10 首版
    expect(winCompatFromOsVersion('win32', '6.3.9600')).toBe(true) // Win8.1
    expect(winCompatFromOsVersion('win32', '6.1.7601')).toBe(true) // Win7 SP1
  })

  it('无 build 号时按主版本号兜底：< 10 为 Win7/8', () => {
    expect(winCompatFromOsVersion('win32', '6.1')).toBe(true)
    expect(winCompatFromOsVersion('win32', '10.0')).toBe(false)
  })
})

describe('Gitee Release 资产按平台匹配（v2.1.0）', () => {
  const assets = [
    { name: 'Pointers-BOX_v2.1.0.apk', url: 'https://gitee.com/x/v2.1.0/app.apk' },
    { name: 'Pointers-BOX_Setup_v2.1.0_Windows7 x64.exe', url: 'https://gitee.com/x/win7.exe', size: 900 },
    { name: 'Pointers-BOX_Setup_V2.1.0 x64.exe', url: 'https://gitee.com/x/win10.exe', size: 1000 },
    { name: 'v2.1.0.zip', url: 'https://gitee.com/x/v2.1.0.zip' }
  ]

  it('win7 匹配含 win7/windows7 的 exe；win10 匹配不含的 exe', () => {
    expect(matchAssetByName(assets, true)?.name).toBe('Pointers-BOX_Setup_v2.1.0_Windows7 x64.exe')
    expect(matchAssetByName(assets, false)?.name).toBe('Pointers-BOX_Setup_V2.1.0 x64.exe')
  })

  it('无 exe 资产返回 undefined；win7 找不到专属包时不兜底（避免推错安装器）', () => {
    const noExe = [{ name: 'v2.1.0.zip', url: 'https://gitee.com/x/v2.1.0.zip' }]
    expect(matchAssetByName(noExe, false)).toBeUndefined()
    expect(matchAssetByName(noExe, true)).toBeUndefined()
    const onlyWin10 = [{ name: 'Setup.exe', url: 'https://gitee.com/x/s.exe' }]
    expect(matchAssetByName(onlyWin10, true)).toBeUndefined()
  })

  it('win10 单一 exe 时可直接使用；资产带 size 透传', () => {
    const single = [{ name: 'Setup.exe', url: 'https://gitee.com/x/s.exe', size: 123 }]
    const hit = matchAssetByName(single, false)
    expect(hit?.url).toBe('https://gitee.com/x/s.exe')
    expect(hit?.size).toBe(123)
  })
})
