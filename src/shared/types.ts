// ── 领域类型（PRD 附录 JSON 模板） ─────────────────────────────

export interface Resource {
  id: number | string
  name: string
  introduction: string
  release_date?: string
  last_modified?: string
  category: string
  links: string[]
}

export interface Announcement {
  date: string
  content: string
}

export interface VersionLog {
  version: string
  log: string
}

export interface ResourceData {
  resources: Resource[]
  version_logs: VersionLog[]
  announcement: Announcement | null
}

export interface BoxInfo {
  app_name: string
  app_version: string
  app_introduction: string
  general_key?: string
  developer: string
  community_qq: string
  copyright: string
}

export interface AuthorWords {
  content: string
}

// ── 配置 ─────────────────────────────────────────────────────

export type AndroidBrowserChoice = 'builtin' | 'system'

export interface AppConfig {
  downloadDir: string
  androidBrowser: AndroidBrowserChoice
}

// ── 下载 ─────────────────────────────────────────────────────

export type DownloadSource = 'browser' | 'update'

export interface DownloadTask {
  id: string
  filename: string
  path: string
  received: number
  total: number
  percent: number
  bytesPerSecond: number
  source: DownloadSource
}

export type DownloadEvent =
  | { type: 'started'; task: DownloadTask }
  | { type: 'progress'; task: DownloadTask }
  | { type: 'done'; id: string; state: 'completed' | 'interrupted' | 'cancelled' }

// ── 更新 ─────────────────────────────────────────────────────

export interface UpdateCheckResult {
  current: string
  latest: string | null
  hasUpdate: boolean
  releaseUrl?: string
  releaseNotes?: string
  error?: string
}

export type UpdateEvent =
  | { type: 'available'; version: string }
  | { type: 'not-available' }
  | { type: 'progress'; percent: number }
  | { type: 'downloaded' }
  | { type: 'error'; message: string }

// ── 数据快照 ─────────────────────────────────────────────────

export interface DataSnapshot {
  data: ResourceData
  box: BoxInfo | null
  authorWords: AuthorWords | null
  offline: boolean
  lastSync: number | null
  /** 校验/清洗/获取过程中产生的告警（已跳过的坏条目等） */
  warnings: string[]
}

// ── 远程数据源（PRD §6.1，以 URL 为准） ───────────────────────

export const REMOTE_URLS = {
  resources: 'https://pointers-box.cc.cd/box/resources.json',
  box: 'https://pointers-box.cc.cd/box/box.json',
  boxzzyhs: 'https://pointers-box.cc.cd/box/boxzzyhs.json'
} as const

// ── IPC 契约（开发计划 §5，先行冻结） ─────────────────────────

export type RestoreTarget = 'resources' | 'box'

export interface PBoxApi {
  getData(): Promise<DataSnapshot>
  refreshData(force?: boolean): Promise<DataSnapshot>
  restoreData(type: RestoreTarget): Promise<boolean>
  getConfig(): Promise<AppConfig>
  setConfig(patch: Partial<AppConfig>): Promise<AppConfig>
  chooseDownloadDir(): Promise<string | null>
  hasActiveDownloads(): Promise<boolean>
  openPath(path: string): Promise<boolean>
  resetBrowserSession(): Promise<void>
  checkUpdate(): Promise<UpdateCheckResult>
  downloadUpdate(): Promise<void>
  installUpdate(): Promise<void>
  onNavigate(cb: (page: string) => void): () => void
  onDownloadEvent(cb: (e: DownloadEvent) => void): () => void
  onUpdateEvent(cb: (e: UpdateEvent) => void): () => void
}
