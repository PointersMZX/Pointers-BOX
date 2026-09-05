// 下载管理（PRD 4.3）：拦截 webview 会话下载 → 路径去重 → 进度事件转发 → 取消/暂停/恢复
import type { DownloadTask } from '../shared/types'
import { sanitizeFilename } from '../shared/filename'
import { getConfig } from './configStore'
import { pickAvailablePath } from './downloads/unique'
import { getBrowserSession } from './sessions'
import { getMainWindow } from './window'
import { existsSync, mkdirSync, unlinkSync } from 'fs'
import { app, type DownloadItem, type Session } from 'electron'

interface DownloadRecord {
  id: string
  filename: string
  path: string
  received: number
  total: number
  bytesPerSecond: number
  paused: boolean
  lastReceived: number
  lastTime: number
}

const active = new Map<string, DownloadRecord>()
const activeItems = new Map<string, DownloadItem>()
const attachedSessions = new WeakSet<object>()
let counter = 0

function makeTask(rec: DownloadRecord): DownloadTask {
  const total = rec.total > 0 ? rec.total : 0
  const percent = total > 0 ? Math.min(100, (rec.received / total) * 100) : 0
  return {
    id: rec.id,
    filename: rec.filename,
    path: rec.path,
    received: rec.received,
    total,
    percent,
    bytesPerSecond: rec.bytesPerSecond,
    paused: rec.paused,
    source: 'browser'
  }
}

function broadcast(payload: unknown): void {
  getMainWindow()?.webContents.send('download:event', payload)
}

export function attachDownloadHandling(target: Session = getBrowserSession()): void {
  // 幂等：同一会话只挂一次（webview 会话创建后二次确保绑定）
  if (attachedSessions.has(target)) return
  attachedSessions.add(target)
  target.on('will-download', (_event, item) => {
    const cfg = getConfig()
    // 落盘目录托底：创建失败时回退系统下载目录，避免任务直接中断
    let dir = cfg.downloadDir
    try {
      mkdirSync(dir, { recursive: true })
    } catch {
      dir = app.getPath('downloads')
      try {
        mkdirSync(dir, { recursive: true })
      } catch {
        // 连系统目录都不可用时交给默认中断流程
      }
    }
    const filename = sanitizeFilename(item.getFilename())
    const savePath = pickAvailablePath(existsSync, dir, filename)
    item.setSavePath(savePath)

    counter += 1
    const id = `dl-${counter}`
    const rec: DownloadRecord = {
      id,
      filename,
      path: savePath,
      received: 0,
      total: item.getTotalBytes(),
      bytesPerSecond: 0,
      paused: false,
      lastReceived: 0,
      lastTime: Date.now()
    }
    active.set(id, rec)
    activeItems.set(id, item)
    broadcast({ type: 'started', task: makeTask(rec) })

    item.on('updated', () => {
      const cur = active.get(id)
      if (!cur) return
      cur.received = item.getReceivedBytes()
      cur.total = item.getTotalBytes()
      cur.paused = item.isPaused()
      const now = Date.now()
      const dt = (now - cur.lastTime) / 1000
      if (dt >= 0.5) {
        cur.bytesPerSecond = Math.round((cur.received - cur.lastReceived) / dt)
        cur.lastTime = now
        cur.lastReceived = cur.received
      }
      broadcast({ type: 'progress', task: makeTask(cur) })
    })

    item.once('done', (_e, state) => {
      active.delete(id)
      activeItems.delete(id)
      // PRD 4.3：任务完成后从列表消失（不记录历史）
      broadcast({
        type: 'done',
        id,
        state:
          state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'interrupted'
      })
      // 用户主动取消：清理半成品文件，避免残留垃圾
      if (state === 'cancelled' && existsSync(rec.path)) {
        try {
          unlinkSync(rec.path)
        } catch {
          // 删除失败忽略（文件可能被占用）
        }
      }
    })
  })
}

// ── 任务控制（取消/暂停/恢复）────────────────────────────────

export function cancelDownload(id: string): boolean {
  const item = activeItems.get(id)
  if (!item) return false
  try {
    item.cancel()
    return true
  } catch {
    return false
  }
}

export function pauseDownload(id: string): boolean {
  const item = activeItems.get(id)
  if (!item || item.isPaused()) return false
  try {
    item.pause()
    return true
  } catch {
    return false
  }
}

export function resumeDownload(id: string): boolean {
  const item = activeItems.get(id)
  if (!item || !item.isPaused()) return false
  try {
    item.resume()
    return true
  } catch {
    return false
  }
}

export function hasActiveDownloads(): boolean {
  return active.size > 0
}
