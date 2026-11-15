import {
  isUpdateChannel,
  normalizeTabSleepMinutes,
  normalizeUpdateChannel,
  winCompatFromOsVersion,
  UPDATE_CHANNEL_INFO,
  UPDATE_CHANNELS
} from '../src/shared/updateChannels'

describe('更新渠道归一化（v2.6.0：Gitee/蓝奏云已关闭，GitHub + 网盘渠道）', () => {
  it('GitHub/网盘合法保留，Gitee/蓝奏云等非法值回 undefined', () => {
    expect(normalizeUpdateChannel('github')).toBe('github')
    expect(normalizeUpdateChannel('netdisk')).toBe('netdisk')
    expect(normalizeUpdateChannel('gitee')).toBeUndefined()
    expect(normalizeUpdateChannel('mirror')).toBeUndefined()
    expect(normalizeUpdateChannel(undefined)).toBeUndefined()
    expect(normalizeUpdateChannel(null)).toBeUndefined()
    expect(normalizeUpdateChannel(42)).toBeUndefined()
  })

  it('isUpdateChannel 类型守卫（GitHub/网盘合法）', () => {
    expect(isUpdateChannel('github')).toBe(true)
    expect(isUpdateChannel('netdisk')).toBe(true)
    expect(isUpdateChannel('gitee')).toBe(false)
    expect(isUpdateChannel('gitlab')).toBe(false)
  })

  it('渠道清单与 URL 均已定义（GitHub 有 API/发布页，网盘有文件链接）', () => {
    expect(UPDATE_CHANNELS).toEqual(['github', 'netdisk'])
    const github = UPDATE_CHANNEL_INFO.github
    expect(github.releaseApi).toMatch(/^https:\/\//)
    expect(github.releasePage).toMatch(/^https:\/\//)
    const netdisk = UPDATE_CHANNEL_INFO.netdisk
    expect(netdisk.releasePage).toMatch(/^https:\/\//)
    expect(netdisk.fileUrl).toBe(netdisk.releasePage)
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
