// ── 领域类型（PRD 附录 JSON 模板） ─────────────────────────────

/** 分享项：一个资源可包含多个不同用途的分享（本体/补丁/汉化等），每项有名称与链接 */
export interface ShareItem {
  name: string
  url: string
}

export interface Resource {
  id: number | string
  name: string
  introduction: string
  release_date?: string
  last_modified?: string
  category: string
  /** 兼容旧格式：纯链接列表（与 shares 二选一，两者都有时优先 shares） */
  links: string[]
  /** v2.0.0 新格式：多分享项（本体/补丁等），含名称与链接 */
  shares?: ShareItem[]
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

// ── 用户自建资源链接（v2.2.0：仅存本地，不参与服务器数据） ─────

export interface UserLink {
  id: string
  /** 链接名称（必填，≤100 字） */
  name: string
  /** 链接地址（必填，http/https，≤2048 字符） */
  url: string
  /** 备注（可选，≤500 字） */
  remark: string
  createdAt: number
}

// ── 配置 ─────────────────────────────────────────────────────

export type AndroidBrowserChoice = 'builtin' | 'system'

/** 更新渠道（v2.1.0）：国内镜像 Gitee / 全球官方 GitHub */
export type UpdateChannel = 'gitee' | 'github'

export interface AppConfig {
  downloadDir: string
  androidBrowser: AndroidBrowserChoice
  /** 外观主题（纯外观，不影响功能）：液态玻璃（默认）/ 纯黑 / 纯白 */
  theme: import('./theme').ThemeKey
  /** 强调色（仅液态玻璃主题可自定义）#rrggbb */
  accent: string
  /** 收藏的资源 id（本地，字符串化；v2.0.0） */
  favorites: string[]
  /** 保留下载历史（默认关闭，与 PRD 4.3 默认约定共存；v2.0.0） */
  keepDownloadHistory: boolean
  /** 更新渠道（v2.1.0）：undefined = 尚未选择（首次启动弹窗询问） */
  updateChannel?: UpdateChannel
  /** 后台标签闲置休眠分钟数（v2.1.0）：0 = 永不休眠 */
  tabSleepMinutes: number
}

// ── 下载历史（v2.0.0：默认关闭的开关，开启后记录已完成任务） ───

export interface DownloadHistoryEntry {
  id: string
  filename: string
  path: string
  total: number
  completedAt: number
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
  /** 任务是否处于暂停状态 */
  paused: boolean
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

/** 更新下载方式（v2.1.0）：双渠道支持 */
export interface UpdateDownloadInfo {
  channel: UpdateChannel
  /** Gitee 渠道：Release 附件直链（含文件名与大小） */
  assetUrl?: string
  assetName?: string
  assetSize?: number
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
  /** 本地应用版本（package.json version，如 2.0.0）；与远程 box.json 的 app_version 无关 */
  getAppVersion(): Promise<string>
  /** 导出配置到用户选择的文件（主题/路径/收藏等）；返回文件路径，取消返回 null */
  exportConfig(): Promise<string | null>
  /** 从文件导入配置并合并应用；成功返回配置，失败/取消返回 null */
  importConfig(): Promise<AppConfig | null>
  /** 下载历史（keepDownloadHistory 开启时才有数据） */
  listDownloadHistory(): Promise<DownloadHistoryEntry[]>
  clearDownloadHistory(): Promise<void>
  getData(): Promise<DataSnapshot>
  refreshData(force?: boolean): Promise<DataSnapshot>
  restoreData(type: RestoreTarget): Promise<boolean>
  /** 用户自建资源链接（v2.2.0：仅存本地） */
  getUserLinks(): Promise<UserLink[]>
  setUserLinks(links: UserLink[]): Promise<UserLink[]>
  /** 文件导入（桌面端弹选择框；Android 返回 null 表示不支持），返回新增/跳过计数 */
  importUserLinks(): Promise<{ added: number; skipped: number } | null>
  /** 文件导出（桌面端弹保存框；Android 返回 null 表示不支持），成功返回文件路径 */
  exportUserLinks(): Promise<string | null>
  getConfig(): Promise<AppConfig>
  setConfig(patch: Partial<AppConfig>): Promise<AppConfig>
  chooseDownloadDir(): Promise<string | null>
  hasActiveDownloads(): Promise<boolean>
  openPath(path: string): Promise<boolean>
  /** 取消下载任务（取消后清理半成品文件）；仅浏览器下载可取消，更新包不支持 */
  cancelDownload(id: string): Promise<boolean>
  pauseDownload(id: string): Promise<boolean>
  resumeDownload(id: string): Promise<boolean>
  resetBrowserSession(): Promise<void>
  checkUpdate(): Promise<UpdateCheckResult>
  downloadUpdate(): Promise<void>
  installUpdate(): Promise<void>
  onNavigate(cb: (page: string) => void): () => void
  onDownloadEvent(cb: (e: DownloadEvent) => void): () => void
  onUpdateEvent(cb: (e: UpdateEvent) => void): () => void
}
