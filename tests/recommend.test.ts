import { sampleUnique } from '../src/renderer/src/utils/recommend'

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
})
