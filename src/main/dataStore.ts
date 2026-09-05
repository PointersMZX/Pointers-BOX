// 数据层编排：远程拉取 → 校验清洗 → 内存缓存 + 工作副本/备份落盘（Electron 相关 API 保持薄壳）
import { app, dialog } from 'electron'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from 'fs'
import { join } from 'path'
import { REMOTE_URLS } from '../shared/types'
import type {
  AuthorWords,
  BoxInfo,
  DataSnapshot,
  ResourceData,
  RestoreTarget
} from '../shared/types'
import { backupFileName, pruneBackupNames } from './data/backup'
import { shouldRefetch } from './data/sync'
import { requestText } from './netRequest'
import {
  DataFileError,
  parseLooseJson,
  validateAnnouncement,
  validateAuthorWords,
  validateBoxInfo,
  validateResources,
  validateVersionLogs
} from '../shared/validate'

const KEEP_BACKUPS = 10
const FETCH_TIMEOUT_MS = 10_000

const WORK_FILES = {
  resources: 'resources.json',
  box: 'box.json',
  boxzzyhs: 'boxzzyhs.json'
} as const

type WorkKey = keyof typeof WORK_FILES

// PRD 6.3 备份名示例 resource-YYYYMMDD-HHmmss.json.bak
function backupKind(key: WorkKey): string {
  return key === 'resources' ? 'resource' : key
}

interface MemoryState {
  data: ResourceData
  box: BoxInfo | null
  authorWords: AuthorWords | null
  offline: boolean
  lastSync: number | null
  warnings: string[]
}

function emptyResourceData(): ResourceData {
  return { resources: [], version_logs: [], announcement: null }
}

let state: MemoryState | null = null

function userDir(): string {
  return app.getPath('userData')
}

function dataDir(): string {
  return join(userDir(), 'data')
}

function backupDir(): string {
  return join(userDir(), 'backups')
}

function lastSyncPath(): string {
  return join(userDir(), 'last-sync.json')
}

function workPath(key: WorkKey): string {
  return join(dataDir(), WORK_FILES[key])
}

function ensureDirs(): void {
  mkdirSync(dataDir(), { recursive: true })
  mkdirSync(backupDir(), { recursive: true })
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function atomicWrite(path: string, text: string): void {
  const tmp = `${path}.tmp`
  try {
    writeFileSync(tmp, text, 'utf-8')
    renameSync(tmp, path)
  } catch {
    // rename 失败（目标被占用等）退化为直接写
    writeFileSync(path, text, 'utf-8')
  }
}

function backupWork(key: WorkKey): void {
  ensureDirs()
  const path = workPath(key)
  if (!existsSync(path)) return
  copyFileSync(path, join(backupDir(), backupFileName(backupKind(key), new Date())))
  rotateBackups(backupKind(key))
}

function rotateBackups(kind: string): void {
  const names = readdirSync(backupDir()).filter(
    (n) => n.startsWith(`${kind}-`) && n.endsWith('.json.bak')
  )
  for (const n of pruneBackupNames(names, KEEP_BACKUPS)) {
    try {
      unlinkSync(join(backupDir(), n))
    } catch {
      // 删除失败忽略，下次轮转再试
    }
  }
}

// 内容有变化才写盘；写前自动备份旧数据（PRD 6.3）
function persistWork(key: WorkKey, rawText: string): void {
  const path = workPath(key)
  if (existsSync(path)) {
    if (readFileSync(path, 'utf-8') === rawText) return
    backupWork(key)
  }
  atomicWrite(path, rawText)
}

async function fetchJson(url: string): Promise<unknown> {
  const { status, text } = await requestText(url, FETCH_TIMEOUT_MS)
  if (status < 200 || status >= 300) throw new Error(`HTTP ${status}`)
  return parseLooseJson(text)
}

function loadFromDisk(): MemoryState {
  const warnings: string[] = []
  let data = emptyResourceData()
  let box: BoxInfo | null = null
  let authorWords: AuthorWords | null = null

  const resourcesPath = workPath('resources')
  if (existsSync(resourcesPath)) {
    try {
      const raw = parseLooseJson(readFileSync(resourcesPath, 'utf-8'))
      const clean = validateResources(raw)
      data = {
        resources: clean.valid,
        version_logs: validateVersionLogs(raw),
        announcement: validateAnnouncement(raw)
      }
      warnings.push(...clean.errors)
    } catch (e) {
      warnings.push(`本地 resources.json 无效已忽略：${msg(e)}`)
    }
  }

  const boxPath = workPath('box')
  if (existsSync(boxPath)) {
    try {
      box = validateBoxInfo(parseLooseJson(readFileSync(boxPath, 'utf-8')))
    } catch (e) {
      warnings.push(`本地 box.json 无效已忽略：${msg(e)}`)
    }
  }

  const wordsPath = workPath('boxzzyhs')
  if (existsSync(wordsPath)) {
    try {
      authorWords = validateAuthorWords(parseLooseJson(readFileSync(wordsPath, 'utf-8')))
    } catch (e) {
      warnings.push(`本地 boxzzyhs.json 无效已忽略：${msg(e)}`)
    }
  }

  let lastSync: number | null = null
  try {
    if (existsSync(lastSyncPath())) {
      const parsed = JSON.parse(readFileSync(lastSyncPath(), 'utf-8')) as Record<string, unknown>
      const v = parsed['lastSync']
      if (typeof v === 'number') lastSync = v
    }
  } catch {
    // last-sync 损坏视作从未同步
  }

  const s: MemoryState = {
    data,
    box,
    authorWords,
    offline: true, // 磁盘数据视作离线态，远程刷新成功后置 false
    lastSync,
    warnings
  }
  state = s
  return s
}

function getMemory(): MemoryState {
  return state ?? loadFromDisk()
}

export function getSnapshot(): DataSnapshot {
  const s = getMemory()
  return {
    data: s.data,
    box: s.box,
    authorWords: s.authorWords,
    offline: s.offline,
    lastSync: s.lastSync,
    warnings: [...s.warnings]
  }
}

export async function refreshRemote(force = false): Promise<DataSnapshot> {
  const s = getMemory()
  if (!force && !shouldRefetch(s.lastSync, Date.now())) return getSnapshot()
  ensureDirs()

  const results = await Promise.allSettled([
    fetchJson(REMOTE_URLS.resources),
    fetchJson(REMOTE_URLS.box),
    fetchJson(REMOTE_URLS.boxzzyhs)
  ])

  const warnings: string[] = []
  let okCount = 0

  const resourcesResult = results[0]
  if (resourcesResult && resourcesResult.status === 'fulfilled') {
    try {
      const clean = validateResources(resourcesResult.value)
      s.data = {
        resources: clean.valid,
        version_logs: validateVersionLogs(resourcesResult.value),
        announcement: validateAnnouncement(resourcesResult.value)
      }
      warnings.push(...clean.errors)
      persistWork('resources', JSON.stringify(resourcesResult.value, null, 2))
      okCount++
    } catch (e) {
      warnings.push(`resources.json 解析失败（保留本地数据）：${msg(e)}`)
    }
  } else if (resourcesResult && resourcesResult.status === 'rejected') {
    warnings.push(`resources.json 获取失败：${msg(resourcesResult.reason)}`)
  }

  const boxResult = results[1]
  if (boxResult && boxResult.status === 'fulfilled') {
    try {
      const info = validateBoxInfo(boxResult.value)
      if (!info) throw new DataFileError('缺少 app_name')
      s.box = info
      persistWork('box', JSON.stringify(boxResult.value, null, 2))
      okCount++
    } catch (e) {
      warnings.push(`box.json 解析失败（保留本地数据）：${msg(e)}`)
    }
  } else if (boxResult && boxResult.status === 'rejected') {
    warnings.push(`box.json 获取失败：${msg(boxResult.reason)}`)
  }

  const wordsResult = results[2]
  if (wordsResult && wordsResult.status === 'fulfilled') {
    try {
      const w = validateAuthorWords(wordsResult.value)
      if (!w) throw new DataFileError('缺少 content')
      s.authorWords = w
      persistWork('boxzzyhs', JSON.stringify(wordsResult.value, null, 2))
      okCount++
    } catch (e) {
      warnings.push(`boxzzyhs.json 解析失败（保留本地数据）：${msg(e)}`)
    }
  } else if (wordsResult && wordsResult.status === 'rejected') {
    warnings.push(`boxzzyhs.json 获取失败：${msg(wordsResult.reason)}`)
  }

  s.warnings = warnings
  s.offline = okCount === 0
  if (okCount === 3) {
    s.lastSync = Date.now()
    atomicWrite(lastSyncPath(), JSON.stringify({ lastSync: s.lastSync }, null, 2))
  }
  return getSnapshot()
}

// 手动恢复（PRD 6.3）：恢复前自动备份当前数据；取消返回 false
export async function restoreFromFile(target: RestoreTarget): Promise<boolean> {
  const s = getMemory()
  const picked = await dialog.showOpenDialog({
    title:
      target === 'resources'
        ? '选择 resources.json 以恢复资源数据'
        : '选择 box.json 以恢复应用信息',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile']
  })
  if (picked.canceled || picked.filePaths.length === 0) return false
  const file = picked.filePaths[0]
  if (!file) return false

  try {
    const raw = parseLooseJson(readFileSync(file, 'utf-8'))
    if (target === 'resources') {
      const clean = validateResources(raw)
      backupWork('resources')
      atomicWrite(workPath('resources'), JSON.stringify(raw, null, 2))
      s.data = {
        resources: clean.valid,
        version_logs: validateVersionLogs(raw),
        announcement: validateAnnouncement(raw)
      }
      s.warnings = [...clean.errors]
      s.offline = true
    } else {
      const info = validateBoxInfo(raw)
      if (!info) throw new DataFileError('box.json 结构错误：缺少 app_name')
      backupWork('box')
      atomicWrite(workPath('box'), JSON.stringify(raw, null, 2))
      s.box = info
      s.warnings = []
    }
    return true
  } catch (e) {
    s.warnings = [`恢复失败：${msg(e)}`]
    return false
  }
}
