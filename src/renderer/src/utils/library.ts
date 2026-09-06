// 资源库纯逻辑（PRD 4.1）：分类树构建、分类+关键词双条件过滤、排序（v2.0.0）
import type { Resource } from '../../../shared/types'

export const ALL_CATEGORY = '全部'

export interface CategoryNode {
  name: string
  count: number
}

export function buildCategoryTree(resources: readonly Resource[]): CategoryNode[] {
  const counts = new Map<string, number>()
  for (const r of resources) {
    counts.set(r.category, (counts.get(r.category) ?? 0) + 1)
  }
  const nodes: CategoryNode[] = [{ name: ALL_CATEGORY, count: resources.length }]
  const names = [...counts.keys()].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
  for (const name of names) {
    nodes.push({ name, count: counts.get(name) ?? 0 })
  }
  return nodes
}

export function filterResources(
  resources: readonly Resource[],
  category: string,
  keyword: string
): Resource[] {
  const kw = keyword.trim().toLowerCase()
  return resources.filter((r) => {
    if (category !== ALL_CATEGORY && r.category !== category) return false
    if (kw === '') return true
    return r.name.toLowerCase().includes(kw) || r.introduction.toLowerCase().includes(kw)
  })
}

// ── 排序（v2.0.0 正式版新增） ─────────────────────────────────

export type SortMode = 'time-desc' | 'time-asc' | 'alpha-asc' | 'alpha-desc'

export const SORT_MODES: ReadonlyArray<{ value: SortMode; label: string }> = [
  { value: 'time-desc', label: '时间（由新至旧）' },
  { value: 'time-asc', label: '时间（由旧至新）' },
  { value: 'alpha-asc', label: '字母（A-Z）' },
  { value: 'alpha-desc', label: '字母（Z-A）' }
]

export const DEFAULT_SORT: SortMode = 'time-desc'

export function normalizeSort(v: unknown): SortMode {
  return SORT_MODES.some((m) => m.value === v) ? (v as SortMode) : DEFAULT_SORT
}

// 时间键：优先 last_modified，其次 release_date；支持 2025.01.15 / 2025-01-15 等写法；无法解析视为 0（最早）
function timeKey(r: Resource): number {
  const raw = r.last_modified ?? r.release_date ?? ''
  const t = Date.parse(String(raw).replace(/\./g, '-'))
  return Number.isNaN(t) ? 0 : t
}

function alphaCmp(a: Resource, b: Resource): number {
  return a.name.localeCompare(b.name, 'zh-Hans-CN')
}

/** 排序：返回新数组（不修改入参）；同键资源按 id 稳定排序 */
export function sortResources(resources: readonly Resource[], mode: SortMode): Resource[] {
  const out = [...resources]
  const tie = (a: Resource, b: Resource): number =>
    String(a.id).localeCompare(String(b.id), 'zh-Hans-CN', { numeric: true })
  switch (mode) {
    case 'time-desc':
      out.sort((a, b) => timeKey(b) - timeKey(a) || tie(a, b))
      break
    case 'time-asc':
      out.sort((a, b) => timeKey(a) - timeKey(b) || tie(a, b))
      break
    case 'alpha-asc':
      out.sort((a, b) => alphaCmp(a, b) || tie(a, b))
      break
    case 'alpha-desc':
      out.sort((a, b) => alphaCmp(b, a) || tie(a, b))
      break
  }
  return out
}
