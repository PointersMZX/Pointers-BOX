import { shouldRefetch } from '../src/main/data/sync'

describe('同步节流（PRD 6.2 last-sync）', () => {
  const now = 1_800_000_000_000

  it('从未同步 → 必须拉取', () => {
    expect(shouldRefetch(null, now)).toBe(true)
  })

  it('TTL 内跳过，超过 TTL 拉取', () => {
    expect(shouldRefetch(now - 4 * 60 * 1000, now)).toBe(false)
    expect(shouldRefetch(now - 5 * 60 * 1000, now)).toBe(true)
    expect(shouldRefetch(now - 10 * 60 * 1000, now)).toBe(true)
  })

  it('自定义 TTL 生效', () => {
    expect(shouldRefetch(now - 1000, now, 500)).toBe(true)
    expect(shouldRefetch(now - 100, now, 500)).toBe(false)
  })
})
