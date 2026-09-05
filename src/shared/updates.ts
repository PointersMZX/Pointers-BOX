// GitHub Release 数据解析（PRD 4.4 检查更新）
export interface ReleaseInfo {
  tagName: string
  htmlUrl?: string
  notes?: string
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
  return {
    tagName,
    htmlUrl: typeof rec['html_url'] === 'string' ? rec['html_url'] : undefined,
    notes: typeof rec['body'] === 'string' ? rec['body'] : undefined
  }
}
