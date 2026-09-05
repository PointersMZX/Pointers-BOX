import { create } from 'zustand'
import type { AppConfig, DownloadEvent, DownloadTask } from '../../../shared/types'
import { backend } from '../platform'

interface DownloadState {
  tasks: DownloadTask[]
  config: AppConfig | null
  loadConfig: () => Promise<void>
  applyEvent: (e: DownloadEvent) => void
  chooseDir: () => Promise<string | null>
  saveConfig: (patch: Partial<AppConfig>) => Promise<void>
  openFolder: () => Promise<boolean>
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
    set({ config: await backend.setConfig(patch) })
  },

  openFolder: async () => {
    const dir = get().config?.downloadDir
    if (!dir) return false
    return backend.openPath(dir)
  }
}))
