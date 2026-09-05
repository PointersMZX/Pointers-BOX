import { formatBytes, percentOf } from '../src/renderer/src/utils/format'

describe('下载进度格式化（PRD 4.3）', () => {
  it('formatBytes 分级换算', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(-5)).toBe('0 B')
    expect(formatBytes(NaN)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(1536 * 1024)).toBe('1.5 MB')
    expect(formatBytes(3 * 1024 ** 3)).toBe('3.0 GB')
    expect(formatBytes(1024 ** 4 * 2)).toBe('2.0 TB')
    expect(formatBytes(1024 ** 5)).toBe('1024 TB') // 超出单位不无限升级
  })

  it('percentOf 计算并夹紧到 0-100', () => {
    expect(percentOf(50, 100)).toBe(50)
    expect(percentOf(1, 3)).toBeCloseTo(33.33, 1)
    expect(percentOf(200, 100)).toBe(100)
    expect(percentOf(-1, 100)).toBe(0)
    expect(percentOf(10, 0)).toBe(0) // 未知大小
    expect(percentOf(10, -5)).toBe(0)
  })
})
