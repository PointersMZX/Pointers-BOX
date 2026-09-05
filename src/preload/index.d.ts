import type { PBoxApi } from '../shared/types'

declare global {
  interface Window {
    api: PBoxApi
  }
}

export {}
