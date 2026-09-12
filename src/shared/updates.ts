// GitHub / Gitee Release 数据解析（PRD 4.4 检查更新；v2.1.0 双渠道）
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
