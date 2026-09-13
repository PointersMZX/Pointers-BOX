import { create } from 'zustand'
import type { UserLink } from '../../../shared/types'
import { sanitizeUserLinks } from '../../../shared/userLinks'
import { backend } from '../platform'

interface LinksState {
  links: UserLink[]
  loaded: boolean
  load: () => Promise<void>
  save: (links: UserLink[]) => Promise<void>
  importLinks: () => Promise<{ added: number; skipped: number } | null>
  exportLinks: () => Promise<string | null>
}

// 用户自建资源链接（v2.2.0）：仅存本地
export const useLinksStore = create<LinksState>((set, get) => ({
  links: [],
  loaded: false,

  load: async () => {
    set({ links: await backend.getUserLinks(), loaded: true })
  },

  save: async (links) => {
    const clean = sanitizeUserLinks(links)
    set({ links: await backend.setUserLinks(clean) })
  },

  importLinks: async () => {
    const result = await backend.importUserLinks()
    if (result) await get().load()
    return result
  },

  exportLinks: async () => {
    return backend.exportUserLinks()
  }
}))
