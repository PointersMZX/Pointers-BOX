// 下载管理（PRD 4.3）：拦截 webview 会话下载 → 路径去重 → 进度事件转发
import type { DownloadTask } from '../shared/types'
import { sanitizeFilename } from '../shared/filename'
import { getConfig } from './configStore'
import { pickAvailablePath } from './downloads/unique'
import { getBrowserSession } from './sessions'
import { getMainWindow } from './window'
import { existsSync, mkdirSync } from 'fs'
import type { Session } from 'electron'

interface DownloadRecord {
  id: string
  filename: string
  path: string
  received: number
  total: number
  bytesPerSecond: number
  lastReceived: number
  lastTime: number
}

const active = new Map<string, DownloadRecord>()
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
    source: 'browser'
  }
}

function broadcast(payload: unknown): void {
  getMainWindow()?.webContents.send('download:event', payload)
}

export function attachDownloadHandling(target: Session = getBrowserSession()): void {
  target.on('will-download', (_event, item) => {
    const cfg = getConfig()
    try {
      mkdirSync(cfg.downloadDir, { recursive: true })
    } catch {
      // 目录创建失败时由 setSavePath 抛错路径兜底
    }
    const filename = sanitizeFilename(item.getFilename())
    const savePath = pickAvailablePath(existsSync, cfg.downloadDir, filename)
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
      lastReceived: 0,
      lastTime: Date.now()
    }
    active.set(id, rec)
    broadcast({ type: 'started', task: makeTask(rec) })

    item.on('updated', () => {
      const cur = active.get(id)
      if (!cur) return
      cur.received = item.getReceivedBytes()
      cur.total = item.getTotalBytes()
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
      // PRD 4.3：任务完成后从列表消失（不记录历史）
      broadcast({
        type: 'done',
        id,
        state: state === 'completed' ? 'completed' : state === 'cancelled' ? 'cancelled' : 'interrupted'
      })
    })
  })
}

export function hasActiveDownloads(): boolean {
  return active.size > 0
}
