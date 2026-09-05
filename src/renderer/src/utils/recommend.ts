// 今日推荐抽取（PRD 3.2）：Fisher-Yates 随机抽 n 个不重复；rng 注入便于测试
export function sampleUnique<T>(items: readonly T[], n: number, rng: () => number = Math.random): T[] {
  const pool = [...items]
  const count = Math.min(Math.max(0, Math.floor(n)), pool.length)
  const out: T[] = []
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (pool.length - i))
    const picked = pool[j] as T
    const moved = pool[i] as T
    pool[i] = picked
    pool[j] = moved
    // 修正：推入随机选中的元素；此前误推固定首位导致「刷新多次不切换」
    out.push(picked)
  }
  return out
}

// 刷新保证切换：优先从「未展示」集合抽取；候选不足 n 时回退全量（避免空结果）
export function sampleUniqueExcluding<K extends string | number, T extends { id: K }>(
  items: readonly T[],
  n: number,
  excludeIds: ReadonlySet<K>,
  rng: () => number = Math.random
): T[] {
  const fresh = items.filter((it) => !excludeIds.has(it.id))
  const source = fresh.length >= n ? fresh : [...items]
  return sampleUnique(source, Math.min(n, source.length), rng)
}
