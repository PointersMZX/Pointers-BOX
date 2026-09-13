// 用户自建资源链接纯逻辑（v2.2.0）：校验、清洗、合并导入
import type { UserLink } from './types'

/** 单脚本上限：防止异常导入撑爆本地文件 */
export const USER_LINKS_MAX = 500

/** 规范化单条链接：名称必填（≤100 字）、链接必须是 http(s)（≤2048 字符）、备注截断（≤500 字） */
export function normalizeUserLink(raw: unknown, index: number): UserLink | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const name = typeof r['name'] === 'string' ? r['name'].trim() : ''
  const url = typeof r['url'] === 'string' ? r['url'].trim() : ''
  if (name === '' || name.length > 100) return null
  if (!/^https?:\/\//i.test(url) || url.length > 2048) return null
  const remark = typeof r['remark'] === 'string' ? r['remark'].trim().slice(0, 500) : ''
  const id =
    typeof r['id'] === 'string' && r['id'].trim() !== ''
      ? r['id'].trim()
      : `ul-${Date.now()}-${index}`
  const createdAt = typeof r['createdAt'] === 'number' ? r['createdAt'] : Date.now()
  return { id, name: name.slice(0, 100), url, remark, createdAt }
}

/** 清洗数组：坏条目跳过、按 url 去重（大小写不敏感）、截断到上限 */
export function sanitizeUserLinks(raw: unknown): UserLink[] {
  if (!Array.isArray(raw)) return []
  const out: UserLink[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const link = normalizeUserLink(item, out.length)
    if (!link) continue
    const key = link.url.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(link)
    if (out.length >= USER_LINKS_MAX) break
  }
  return out
}

/** 合并导入：按 url 去重（大小写不敏感），不修改已有条目 */
export function mergeUserLinks(
  existing: UserLink[],
  incoming: UserLink[]
): { merged: UserLink[]; added: number; skipped: number } {
  const seen = new Set(existing.map((l) => l.url.toLowerCase()))
  const merged = [...existing]
  let added = 0
  let skipped = 0
  for (const link of incoming) {
    const key = link.url.toLowerCase()
    if (seen.has(key)) {
      skipped++
      continue
    }
    seen.add(key)
    merged.push(link)
    added++
  }
  return { merged, added, skipped }
}
