// 浏览器会话（PRD 4.2）：内存分区（不落盘）→ 进程退出自动重置登录状态
import { session, type Session } from 'electron'
import { RESET_STORAGES } from '../shared/browser'

// 非 persist: 前缀 = 内存型 session，随进程销毁（PRD 7.3 第 5 条结构性保证）
export const BROWSER_PARTITION = 'pbox-mem'

export function getBrowserSession(): Session {
  return session.fromPartition(BROWSER_PARTITION)
}

export async function resetBrowserSession(): Promise<void> {
  await getBrowserSession().clearStorageData({ storages: [...RESET_STORAGES] })
}
