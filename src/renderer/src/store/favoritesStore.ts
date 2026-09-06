import { create } from 'zustand'
import { backend } from '../platform'

// 收藏/常用资源（v2.0.0）：本地 config.favorites 持久化（不碰服务端）
// localStorage 缓存用于启动瞬时渲染，配置加载后校正
interface FavoritesState {
  ids: Set<string>
  loaded: boolean
  bootstrap: () => Promise<void>
  toggle: (id: string | number) => Promise<void>
  isFavorite: (id: string | number) => boolean
}

const LS_KEY = 'pbox-favorites'

function readCache(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const arr = raw ? (JSON.parse(raw) as unknown) : null
    return new Set(Array.isArray(arr) ? arr.map(String) : [])
  } catch {
    return new Set()
  }
}

function writeCache(ids: Set<string>): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...ids]))
  } catch {
    // 缓存失败不影响功能
  }
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  ids: typeof localStorage === 'undefined' ? new Set<string>() : readCache(),
  loaded: false,

  bootstrap: async () => {
    try {
      const cfg = await backend.getConfig()
      const ids = new Set(cfg.favorites.map(String))
      writeCache(ids)
      set({ ids, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  toggle: async (id) => {
    const key = String(id)
    const next = new Set(get().ids)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    set({ ids: next })
    writeCache(next)
    try {
      await backend.setConfig({ favorites: [...next] })
    } catch {
      // 持久化失败时本地状态仍生效
    }
  },

  isFavorite: (id) => get().ids.has(String(id))
}))
