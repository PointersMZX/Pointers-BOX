import { create } from 'zustand'
import type {
  Announcement,
  BoxInfo,
  DataSnapshot,
  RestoreTarget,
  Resource,
  VersionLog
} from '../../../shared/types'
import { backend } from '../platform'

interface DataState {
  loaded: boolean
  loading: boolean
  resources: Resource[]
  /** 版本日志（boxbbgxrz.json 独立文件；新→旧） */
  versionLogs: VersionLog[]
  announcement: Announcement | null
  box: BoxInfo | null
  offline: boolean
  lastSync: number | null
  warnings: string[]
  bootstrap: () => Promise<void>
  refresh: (force: boolean) => Promise<void>
  restore: (target: RestoreTarget) => Promise<boolean>
}

type SetState = (partial: Partial<DataState>) => void

function applySnapshot(set: SetState, snap: DataSnapshot): void {
  set({
    loaded: true,
    resources: snap.data.resources,
    versionLogs: snap.versionLogs,
    announcement: snap.data.announcement,
    box: snap.box,
    offline: snap.offline,
    lastSync: snap.lastSync,
    warnings: snap.warnings
  })
}

export const useDataStore = create<DataState>((set, get) => ({
  loaded: false,
  loading: false,
  resources: [],
  versionLogs: [],
  announcement: null,
  box: null,
  offline: false,
  lastSync: null,
  warnings: [],

  bootstrap: async () => {
    if (get().loading) return
    set({ loading: true })
    try {
      applySnapshot(set as SetState, await backend.getData())
      applySnapshot(set as SetState, await backend.refreshData(false))
    } catch {
      // 平台后端异常时保持空数据 + 离线态
      set({ loaded: true, offline: true })
    } finally {
      set({ loading: false })
    }
  },

  refresh: async (force) => {
    applySnapshot(set as SetState, await backend.refreshData(force))
  },

  restore: async (target) => {
    const ok = await backend.restoreData(target)
    if (ok) applySnapshot(set as SetState, await backend.getData())
    return ok
  }
}))
