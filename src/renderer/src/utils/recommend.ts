// 今日推荐抽取（PRD 3.2）：Fisher-Yates 随机抽 n 个不重复；rng 注入便于测试
export function sampleUnique<T>(items: readonly T[], n: number, rng: () => number = Math.random): T[] {
  const pool = [...items]
  const count = Math.min(Math.max(0, Math.floor(n)), pool.length)
  const out: T[] = []
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (pool.length - i))
    const pi = pool[i] as T
    const pj = pool[j] as T
    pool[i] = pj
    pool[j] = pi
    out.push(pi)
  }
  return out
}
