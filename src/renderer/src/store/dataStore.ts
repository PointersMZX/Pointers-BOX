import { create } from 'zustand'
import type {
  Announcement,
  AuthorWords,
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
  versionLogs: VersionLog[]
  announcement: Announcement | null
  box: BoxInfo | null
  authorWords: AuthorWords | null
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
    versionLogs: snap.data.version_logs,
    announcement: snap.data.announcement,
    box: snap.box,
    authorWords: snap.authorWords,
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
  authorWords: null,
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
