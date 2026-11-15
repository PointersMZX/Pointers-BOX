// GitHub / Gitee Release 数据解析（PRD 4.4 检查更新；v2.1.0 双渠道）
import { compareVersions } from './semver'

export interface ReleaseAssetInfo {
  name: string
  url: string
  size?: number
}

export interface ReleaseInfo {
  tagName: string
  htmlUrl?: string
  notes?: string
  /** v2.1.0：Release 附件（Gitee assets / GitHub assets 字段，格式一致） */
  assets?: ReleaseAssetInfo[]
}

function parseAssets(raw: unknown): ReleaseAssetInfo[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const out: ReleaseAssetInfo[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const rec = item as Record<string, unknown>
    // Gitee: browser_download_url + name；GitHub: browser_download_url + name + size
    const url =
      typeof rec['browser_download_url'] === 'string' ? rec['browser_download_url'] : undefined
    const name = typeof rec['name'] === 'string' ? rec['name'] : undefined
    if (!url || !name) continue
    const size = typeof rec['size'] === 'number' ? rec['size'] : undefined
    out.push({ name, url, size })
  }
  return out
}

export function parseReleaseJson(text: string): ReleaseInfo | null {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
  const rec = data as Record<string, unknown>
  const tagName = rec['tag_name']
  if (typeof tagName !== 'string' || tagName.trim() === '') return null
  const assets = parseAssets(rec['assets'])
  return {
    tagName,
    htmlUrl: typeof rec['html_url'] === 'string' ? rec['html_url'] : undefined,
    notes: typeof rec['body'] === 'string' ? rec['body'] : undefined,
    ...(assets ? { assets } : {})
  }
}

/**
 * 从 Release 列表（GitHub /releases 数组）中取版本号最高的一个（v2.6.0）：
 * 测试版类型 = 正式版 + Pre 版都接受，谁新用谁；跳过草稿。
 */
export function pickNewestRelease(items: unknown): ReleaseInfo | null {
  if (!Array.isArray(items)) return null
  const releases: ReleaseInfo[] = []
  for (const item of items) {
    if (typeof item !== 'object' || item === null) continue
    if ((item as Record<string, unknown>)['draft'] === true) continue
    const parsed = parseReleaseJson(JSON.stringify(item))
    if (parsed) releases.push(parsed)
  }
  if (releases.length === 0) return null
  releases.sort((a, b) => compareVersions(b.tagName, a.tagName))
  return releases[0] ?? null
}
