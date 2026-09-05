import type { DetailedHTMLProps, HTMLAttributes } from 'react'

// <webview> 标签的最小结构化类型与事件声明（避免 renderer 依赖 electron 类型命名空间）
export interface WebviewNavigateEvent {
  url: string
}

export interface WebviewFailLoadEvent {
  errorCode: number
  errorDescription: string
  validatedURL: string
  isMainFrame: boolean
}

export interface WebviewEventMap {
  'did-navigate': WebviewNavigateEvent
  'did-navigate-in-page': WebviewNavigateEvent
  'did-start-loading': Event
  'did-stop-loading': Event
  'did-fail-load': WebviewFailLoadEvent
}

export interface PBoxWebview extends HTMLElement {
  loadURL(url: string): Promise<void>
  goBack(): void
  goForward(): void
  reload(): void
  reloadIgnoringCache(): void
  stop(): void
  canGoBack(): boolean
  canGoForward(): boolean
  clearHistory(): void
  addEventListener<K extends keyof WebviewEventMap & string>(
    type: K,
    listener: (this: PBoxWebview, ev: WebviewEventMap[K]) => void,
    options?: boolean | AddEventListenerOptions
  ): void
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void
  removeEventListener<K extends keyof WebviewEventMap & string>(
    type: K,
    listener: (this: PBoxWebview, ev: WebviewEventMap[K]) => void,
    options?: boolean | EventListenerOptions
  ): void
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions
  ): void
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string
        partition?: string
        allowpopups?: boolean
        useragent?: string
      }
    }
  }
}
