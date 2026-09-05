// 下载进度展示工具（纯函数）
const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B'
  let v = n
  let i = 0
  while (v >= 1024 && i < UNITS.length - 1) {
    v /= 1024
    i += 1
  }
  const unit = UNITS[i] ?? 'B'
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${unit}`
}

// total<=0（未知大小）时返回 0
export function percentOf(received: number, total: number): number {
  if (!Number.isFinite(received) || !Number.isFinite(total) || total <= 0) return 0
  return Math.min(100, Math.max(0, (received / total) * 100))
}
