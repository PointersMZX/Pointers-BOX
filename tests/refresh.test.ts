import { withCacheBust } from '../src/shared/refresh'

describe('强刷缓存击穿（v2.3.2：静态托管对同 URL 可能长缓存，用户主动刷新需拿最新）', () => {
  const ts = 1_800_000_000_000

  it('普通 URL 追加 ?t=', () => {
    expect(withCacheBust('https://x.cc/box/resources.json', ts)).toBe(
      `https://x.cc/box/resources.json?t=${ts}`
    )
  })

  it('已带查询参数的 URL 用 & 追加', () => {
    expect(withCacheBust('https://x.cc/box/a.json?k=1', ts)).toBe(
      `https://x.cc/box/a.json?k=1&t=${ts}`
    )
  })

  it('默认时间戳（不传 ts 也能用）', () => {
    const before = Date.now()
    const out = withCacheBust('https://x.cc/box/b.json')
    const after = Date.now()
    const m = out.match(/\?t=(\d+)$/)
    expect(m).not.toBeNull()
    const t = Number(m!.at(1))
    expect(t).toBeGreaterThanOrEqual(before)
    expect(t).toBeLessThanOrEqual(after)
  })

  it('空串原样返回（防御）', () => {
    expect(withCacheBust('', ts)).toBe('')
  })
})
