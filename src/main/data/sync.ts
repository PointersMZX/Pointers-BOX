// 同步节流：距上次成功同步不足 TTL 时跳过远程拉取
export const SYNC_TTL_MS = 5 * 60 * 1000

export function shouldRefetch(lastSync: number | null, now: number, ttl = SYNC_TTL_MS): boolean {
  if (lastSync === null) return true
  return now - lastSync >= ttl
}
