import { create } from 'zustand'
import type { AppConfig, DownloadEvent, DownloadTask } from '../../../shared/types'
import { backend } from '../platform'

interface DownloadState {
  tasks: DownloadTask[]
  config: AppConfig | null
  loadConfig: () => Promise<void>
  applyEvent: (e: DownloadEvent) => void
  chooseDir: () => Promise<string | null>
  saveConfig: (patch: Partial<AppConfig>) => Promise<AppConfig>
  openFolder: () => Promise<boolean>
  cancel: (id: string) => Promise<void>
  pause: (id: string) => Promise<void>
  resume: (id: string) => Promise<void>
}

function upsert(tasks: DownloadTask[], task: DownloadTask): DownloadTask[] {
  const idx = tasks.findIndex((t) => t.id === task.id)
  if (idx === -1) return [...tasks, task]
  const next = [...tasks]
  next[idx] = task
  return next
}

export const useDownloadStore = create<DownloadState>((set, get) => ({
  tasks: [],
  config: null,

  loadConfig: async () => {
    // v2.2.0：主进程返回完整 AppConfig，整组同步（此前部分快照会把 homeLayout 等字段冲回 undefined）
    set({ config: await backend.getConfig() })
  },

  applyEvent: (e) => {
    if (e.type === 'done') {
      // PRD 4.3：完成后从列表消失，不记录历史
      set({ tasks: get().tasks.filter((t) => t.id !== e.id) })
      return
    }
    set({ tasks: upsert(get().tasks, e.task) })
  },

  chooseDir: async () => {
    const dir = await backend.chooseDownloadDir()
    if (dir) set({ config: await backend.getConfig() })
    return dir
  },

  saveConfig: async (patch) => {
    // v2.2.0：setConfig 返回主进程合并后的完整配置，直接作为 store 新值（消除过期快照回写）
    const next = await backend.setConfig(patch)
    set({ config: next })
    return next
  },

  openFolder: async () => {
    const dir = get().config?.downloadDir
    if (!dir) return false
    return backend.openPath(dir)
  },

  cancel: async (id) => {
    await backend.cancelDownload(id)
  },

  pause: async (id) => {
    await backend.pauseDownload(id)
  },

  resume: async (id) => {
    await backend.resumeDownload(id)
  }
}))
