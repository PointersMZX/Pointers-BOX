// 下载保存路径去重（fs.exists 注入，便于单测）
import { join } from 'path'

const MAX_TRIES = 9999

export function pickAvailablePath(
  exists: (p: string) => boolean,
  dir: string,
  filename: string
): string {
  const target = join(dir, filename)
  if (!exists(target)) return target

  // 点文件（.bashrc）整体作词干，避免把整名当扩展名
  const dotIdx = filename.startsWith('.') ? -1 : filename.lastIndexOf('.')
  const stem = dotIdx > 0 ? filename.slice(0, dotIdx) : filename
  const ext = dotIdx > 0 ? filename.slice(dotIdx) : ''

  for (let i = 1; i <= MAX_TRIES; i++) {
    const candidate = join(dir, `${stem}(${i})${ext}`)
    if (!exists(candidate)) return candidate
  }
  return join(dir, `${stem}-${Date.now()}${ext}`)
}
