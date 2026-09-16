// 远程 JSON 校验与清洗：顶层结构错误抛 DataFileError；条目级问题跳过并记录（PRD 7.6）
// 纯模块（无 Electron 依赖）：主进程与 Android 渲染端共用
import type { Announcement, BoxInfo, Resource, ShareItem, VersionLog } from './types'

export class DataFileError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DataFileError'
  }
}

export interface CleanResult<T> {
  valid: T
  invalidCount: number
  errors: string[]
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// 非空字符串
function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null
}

// 允许空串的字符串
function asLooseString(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new DataFileError('JSON 解析失败：文件内容不是合法 JSON')
  }
}

// 容错解析：服务器偶发以 Markdown 代码围栏包裹 JSON（box.json / boxzzyhs.json 实测如此），
// 直接解析失败时剥离围栏提取最外层 JSON 对象重试
export function parseLooseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    // fallthrough
  }
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1))
    } catch {
      // fallthrough
    }
  }
  throw new DataFileError('JSON 解析失败：文件内容不是合法 JSON（含围栏包裹内容）')
}

// 解析 v2.0.0 多分享项格式：接受 [{name,url}] / [{url}] / ["url"] 混合；name 缺省自动编号
function parseShares(v: unknown, errors: string[], idx: number): ShareItem[] {
  if (v === undefined || v === null) return [] // 未提供 shares 属正常（旧格式）
  if (!Array.isArray(v)) {
    errors.push(`resources[${idx}].shares 不是数组，已忽略`)
    return []
  }
  const out: ShareItem[] = []
  ;(v as unknown[]).forEach((s, si) => {
    if (typeof s === 'string') {
      if (s.trim() !== '') out.push({ name: `分享项 ${out.length + 1}`, url: s.trim() })
      return
    }
    if (isRecord(s)) {
      const url = asString(s['url']) ?? asString(s['link'])
      if (url === null) {
        errors.push(`resources[${idx}].shares[${si}] 缺少 url，已跳过`)
        return
      }
      out.push({ name: asString(s['name']) ?? `分享项 ${out.length + 1}`, url })
    }
  })
  return out
}

export function validateResources(raw: unknown): CleanResult<Resource[]> {
  // v2.2.0：独立文件，顶层直接是资源数组；同时容忍旧 { resources: [...] } 包裹格式
  let list: unknown[]
  if (Array.isArray(raw)) {
    list = raw
  } else if (isRecord(raw) && Array.isArray(raw['resources'])) {
    list = raw['resources'] as unknown[]
  } else {
    throw new DataFileError('resources.json 结构错误：顶层需为资源数组（或旧格式 { resources: [...] }）')
  }
  const resources: Resource[] = []
  const errors: string[] = []
  list.forEach((item, idx) => {
    if (!isRecord(item)) {
      errors.push(`resources[${idx}] 不是对象，已跳过`)
      return
    }
    const id = item['id']
    const name = asString(item['name'])
    const links = Array.isArray(item['links'])
      ? (item['links'] as unknown[]).filter(
          (l): l is string => typeof l === 'string' && l.trim() !== ''
        )
      : []
    const shares = parseShares(item['shares'], errors, idx)
    const idOk = typeof id === 'number' || typeof id === 'string'
    // v2.0.0：links 与 shares 至少有一个即可
    if (!idOk || name === null || (links.length === 0 && shares.length === 0)) {
      errors.push(`resources[${idx}] 缺少有效 id/name/links/shares，已跳过`)
      return
    }
    resources.push({
      id,
      name,
      introduction: asLooseString(item['introduction']),
      release_date: asString(item['release_date']) ?? undefined,
      last_modified: asString(item['last_modified']) ?? undefined,
      category: asString(item['category']) ?? '未分类',
      links,
      ...(shares.length > 0 ? { shares } : {})
    })
  })
  return { valid: resources, invalidCount: errors.length, errors }
}

/** 取资源的分享项列表：优先 shares，旧格式从 links 派生（自动编号） */
export function getResourceShares(resource: Resource): ShareItem[] {
  if (resource.shares && resource.shares.length > 0) return resource.shares
  return resource.links.map((url, i) => ({ name: `分享项 ${i + 1}`, url }))
}

export function validateAnnouncement(raw: unknown): Announcement | null {
  // v2.2.0：独立公告文件，顶层即 { date, content }；同时容忍旧 { announcement: {...} } 包裹
  const a = isRecord(raw) ? (isRecord(raw['announcement']) ? raw['announcement'] : raw) : null
  if (!a) return null
  const content = asString(a['content'])
  if (content === null) return null
  return { date: asString(a['date']) ?? '', content }
}

// 版本日志（boxbbgxrz.json，独立文件）：接受 { version_logs: [...] }，也容忍顶层直接是数组
export function validateVersionLogs(raw: unknown): VersionLog[] {
  let list: unknown[] = []
  if (Array.isArray(raw)) list = raw
  else if (isRecord(raw) && Array.isArray(raw['version_logs'])) list = raw['version_logs'] as unknown[]
  return list
    .filter(isRecord)
    .map((v) => ({ version: asString(v['version']) ?? '', log: asLooseString(v['log']) }))
    .filter((v) => v.version !== '')
}

export function validateBoxInfo(raw: unknown): BoxInfo | null {
  if (!isRecord(raw)) return null
  const app_name = asString(raw['app_name'])
  if (app_name === null) return null
  return {
    app_name,
    app_introduction: asLooseString(raw['app_introduction']),
    general_key: asString(raw['general_key']) ?? undefined,
    developer: asString(raw['developer']) ?? '',
    community_qq: asString(raw['community_qq']) ?? '',
    copyright: asLooseString(raw['copyright'])
  }
}
