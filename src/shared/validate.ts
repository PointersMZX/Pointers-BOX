// 远程 JSON 校验与清洗：顶层结构错误抛 DataFileError；条目级问题跳过并记录（PRD 7.6）
// 纯模块（无 Electron 依赖）：主进程与 Android 渲染端共用
import type { Announcement, AuthorWords, BoxInfo, Resource, VersionLog } from './types'

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

export function validateResources(raw: unknown): CleanResult<Resource[]> {
  if (!isRecord(raw) || !Array.isArray(raw['resources'])) {
    throw new DataFileError('resource.json 结构错误：缺少 resources 数组')
  }
  const resources: Resource[] = []
  const errors: string[] = []
  const list = raw['resources'] as unknown[]
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
    const idOk = typeof id === 'number' || typeof id === 'string'
    if (!idOk || name === null || links.length === 0) {
      errors.push(`resources[${idx}] 缺少有效 id/name/links，已跳过`)
      return
    }
    resources.push({
      id,
      name,
      introduction: asLooseString(item['introduction']),
      release_date: asString(item['release_date']) ?? undefined,
      last_modified: asString(item['last_modified']) ?? undefined,
      category: asString(item['category']) ?? '未分类',
      links
    })
  })
  return { valid: resources, invalidCount: errors.length, errors }
}

export function validateAnnouncement(raw: unknown): Announcement | null {
  if (!isRecord(raw)) return null
  const a = raw['announcement']
  if (!isRecord(a)) return null
  const content = asString(a['content'])
  if (content === null) return null
  return { date: asString(a['date']) ?? '', content }
}

export function validateVersionLogs(raw: unknown): VersionLog[] {
  if (!isRecord(raw) || !Array.isArray(raw['version_logs'])) return []
  return (raw['version_logs'] as unknown[])
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
    app_version: asString(raw['app_version']) ?? '',
    app_introduction: asLooseString(raw['app_introduction']),
    general_key: asString(raw['general_key']) ?? undefined,
    developer: asString(raw['developer']) ?? '',
    community_qq: asString(raw['community_qq']) ?? '',
    copyright: asLooseString(raw['copyright'])
  }
}

export function validateAuthorWords(raw: unknown): AuthorWords | null {
  if (!isRecord(raw)) return null
  const content = asString(raw['content'])
  return content === null ? null : { content }
}
