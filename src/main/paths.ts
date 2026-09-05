import { app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'

// 开发态：项目根/resources；打包态：extraResources 复制到 process.resourcesPath
export function resourcesRoot(): string {
  const devRoot = join(app.getAppPath(), 'resources')
  if (existsSync(join(devRoot, 'icons'))) return devRoot
  return process.resourcesPath || devRoot
}

export function iconFile(name: string): string {
  return join(resourcesRoot(), 'icons', name)
}

export function splashFile(): string {
  return join(resourcesRoot(), 'splash', 'splash.html')
}
