// 用户自建资源链接（user-links.json）：仅存本地，原子写（v2.2.0）
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import { sanitizeUserLinks } from '../shared/userLinks'
import type { UserLink } from '../shared/types'

let cached: UserLink[] | null = null

function linksPath(): string {
  return join(app.getPath('userData'), 'user-links.json')
}

export function getUserLinks(): UserLink[] {
  if (cached) return cached
  let raw: unknown = null
  try {
    if (existsSync(linksPath())) raw = JSON.parse(readFileSync(linksPath(), 'utf-8'))
  } catch {
    // 文件损坏时按空处理
  }
  cached = sanitizeUserLinks(raw)
  return cached
}

export function setUserLinks(links: unknown): UserLink[] {
  const next = sanitizeUserLinks(links)
  cached = next
  try {
    mkdirSync(app.getPath('userData'), { recursive: true })
    const tmp = `${linksPath()}.tmp`
    writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf-8')
    renameSync(tmp, linksPath())
  } catch {
    // 写盘失败时内存值仍然生效，下次修改重试
  }
  return next
}
