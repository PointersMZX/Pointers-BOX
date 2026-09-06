// 下载历史（v2.0.0）：默认关闭的开关（PRD 4.3“完成后不记录历史”的兼容扩展）。
// 开启后记录已完成的下载任务，持久化到 userData/download-history.json，上限 200 条。
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { DownloadHistoryEntry } from '../shared/types'

const MAX_ENTRIES = 200
let cached: DownloadHistoryEntry[] | null = null

function historyPath(): string {
  return join(app.getPath('userData'), 'download-history.json')
}

function load(): DownloadHistoryEntry[] {
  if (cached) return cached
  try {
    if (existsSync(historyPath())) {
      const raw = JSON.parse(readFileSync(historyPath(), 'utf-8')) as unknown
      cached = Array.isArray(raw) ? (raw as DownloadHistoryEntry[]).filter(isEntry) : []
      return cached
    }
  } catch {
    // 损坏时重置
  }
  cached = []
  return cached
}

function isEntry(v: unknown): v is DownloadHistoryEntry {
  if (typeof v !== 'object' || v === null) return false
  const e = v as Record<string, unknown>
  return typeof e['id'] === 'string' && typeof e['filename'] === 'string' && typeof e['path'] === 'string'
}

function save(list: DownloadHistoryEntry[]): void {
  cached = list
  try {
    mkdirSync(app.getPath('userData'), { recursive: true })
    const tmp = `${historyPath()}.tmp`
    writeFileSync(tmp, JSON.stringify(list, null, 2), 'utf-8')
    renameSync(tmp, historyPath())
  } catch {
    // 写盘失败时内存值仍生效
  }
}

/** 记录一条已完成下载（仅 keepDownloadHistory 开启时调用） */
export function addHistoryEntry(entry: Omit<DownloadHistoryEntry, 'completedAt'>): void {
  const list = load()
  // 同路径去重：旧记录移除，新记录置顶
  const next = [
    { ...entry, completedAt: Date.now() },
    ...list.filter((e) => e.path !== entry.path)
  ].slice(0, MAX_ENTRIES)
  save(next)
}

export function listHistory(): DownloadHistoryEntry[] {
  return [...load()].sort((a, b) => b.completedAt - a.completedAt)
}

export function clearHistory(): void {
  save([])
}
