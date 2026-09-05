// 资源库纯逻辑（PRD 4.1）：分类树构建、分类+关键词双条件过滤
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
