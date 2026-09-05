// 用户配置（config.json）：默认值合并 + 原子写（PRD 6.1/6.2）
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import { normalizeConfig } from '../shared/config'
import type { AppConfig } from '../shared/types'

let cached: AppConfig | null = null

function configPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

export function getConfig(): AppConfig {
  if (cached) return cached
  let raw: unknown = null
  try {
    if (existsSync(configPath())) raw = JSON.parse(readFileSync(configPath(), 'utf-8'))
  } catch {
    // 配置损坏时回退默认值
  }
  cached = normalizeConfig(raw, app.getPath('downloads'))
  return cached
}

export function setConfig(patch: Partial<AppConfig>): AppConfig {
  const next = normalizeConfig({ ...getConfig(), ...patch }, app.getPath('downloads'))
  cached = next
  try {
    mkdirSync(app.getPath('userData'), { recursive: true })
    const tmp = `${configPath()}.tmp`
    writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf-8')
    renameSync(tmp, configPath())
  } catch {
    // 写盘失败时内存值仍然生效，下次修改重试
  }
  return next
}
