import { sampleUnique, sampleUniqueExcluding } from '../src/renderer/src/utils/recommend'

interface Item {
  id: number
}

function seq(...values: number[]): () => number {
  let i = 0
  return () => values[i++ % values.length] as number
}

describe('今日推荐抽取（PRD 3.2 每次随机抽 3 个）', () => {
  const items: Item[] = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]

  it('抽取数量为 3 且不重复', () => {
    const out = sampleUnique(items, 3, seq(0.99, 0, 0.5))
    expect(out).toHaveLength(3)
    const ids = new Set(out.map((o) => o.id))
    expect(ids.size).toBe(3)
    out.forEach((o) => expect(items).toContain(o))
  })

  it('候选不足 3 个时返回全部', () => {
    const two = [{ id: 9 }, { id: 8 }]
    expect(sampleUnique(two, 3, () => 0)).toHaveLength(2)
  })

  it('空数据返回空数组，n<=0 返回空数组', () => {
    expect(sampleUnique([], 3)).toEqual([])
    expect(sampleUnique(items, 0)).toEqual([])
    expect(sampleUnique(items, -2)).toEqual([])
  })

  it('同一 rng 序列结果可复现', () => {
    const a = sampleUnique(items, 3, seq(0.1, 0.2, 0.3))
    const b = sampleUnique(items, 3, seq(0.1, 0.2, 0.3))
    expect(a).toEqual(b)
  })

  it('不修改输入数组', () => {
    const snapshot = [...items]
    sampleUnique(items, 5, () => 0.5)
    expect(items).toEqual(snapshot)
  })

  it('抽取真正随机：rng 恒近 1 时首位应选中最末元素（回归：旧实现恒取首位）', () => {
    const five: Item[] = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]
    expect(sampleUnique(five, 1, () => 0.9999)).toEqual([{ id: 5 }])
  })

  it('rng 恒为 0 时按原顺序选取（恒等置换）', () => {
    const five: Item[] = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]
    expect(sampleUnique(five, 5, () => 0)).toEqual(five)
  })

  it('首位不恒为第一条（大样本统计回归）', () => {
    const ten: Item[] = Array.from({ length: 10 }, (_, i) => ({ id: i + 1 }))
    const firsts = new Set<number>()
    for (let i = 0; i < 200; i++) {
      firsts.add(sampleUnique(ten, 1, Math.random)[0]!.id)
    }
    // 200 次抽样应覆盖大部分起点（若恒取首位则集合大小为 1）
    expect(firsts.size).toBeGreaterThan(5)
  })})

describe('刷新保证切换（排除已展示集合）', () => {
  const items: Item[] = [
    { id: 1 },
    { id: 2 },
    { id: 3 },
    { id: 4 },
    { id: 5 },
    { id: 6 },
    { id: 7 },
    { id: 8 }
  ]

  it('已展示的 id 不再出现（连续刷新必定切换）', () => {
    const shown = new Set([1, 2, 3])
    for (let round = 0; round < 20; round++) {
      const out = sampleUniqueExcluding(items, 3, shown, Math.random)
      expect(out).toHaveLength(3)
      out.forEach((o) => expect(shown.has(o.id)).toBe(false))
    }
  })

  it('排除后候选不足 n 个时回退全量，仍返回 n 个', () => {
    // 排除 1-7，只剩 {8} → 回退全量抽 3
    const shown = new Set([1, 2, 3, 4, 5, 6, 7])
    const out = sampleUniqueExcluding(items, 3, shown, () => 0)
    expect(out).toHaveLength(3)
    expect(out.every((o) => items.includes(o))).toBe(true)
  })

  it('空排除集合等价于普通抽样', () => {
    const out = sampleUniqueExcluding(items, 3, new Set<number>(), seq(0.1, 0.2, 0.3))
    const plain = sampleUnique(items, 3, seq(0.1, 0.2, 0.3))
    expect(out).toEqual(plain)
  })

  it('数据不足 n 个时返回全部且不重复', () => {
    const two = [{ id: 9 }, { id: 10 }]
    const out = sampleUniqueExcluding(two, 3, new Set([9]), () => 0.5)
    expect(out).toHaveLength(2)
    expect(new Set(out.map((o) => o.id)).size).toBe(2)
  })
})
