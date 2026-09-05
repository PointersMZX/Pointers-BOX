// 退出状态（独立模块，避免 index ↔ tray 循环依赖）
let quitting = false

export function markQuitting(): void {
  quitting = true
}

export function isQuitting(): boolean {
  return quitting
}
