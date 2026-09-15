// 用户配置（config.json）：默认值合并 + 原子写（PRD 6.1/6.2）
// v2.2.0：读取每次走磁盘（文件很小），写入前也重读磁盘——彻底移除进程内缓存。
// 缓存会导致：外部改文件不生效、旧快照合并写回、多进程（主/渲染）视图不一致。
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import { normalizeConfig } from '../shared/config'
import type { AppConfig } from '../shared/types'

function configPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

function readFromDisk(): AppConfig {
  let raw: unknown = null
  try {
    if (existsSync(configPath())) {
      // 剥离 UTF-8 BOM（PowerShell Set-Content 默认写入 BOM，JSON.parse 直接报错）
      raw = JSON.parse(readFileSync(configPath(), 'utf-8').replace(/^\uFEFF/, ''))
    }
  } catch {
    // 配置损坏时回退默认值
  }
  return normalizeConfig(raw, app.getPath('downloads'))
}

export function getConfig(): AppConfig {
  return readFromDisk()
}

export function setConfig(patch: Partial<AppConfig>): AppConfig {
  // 基于磁盘最新值合并（外部写入/其他窗口修改不会被旧快照冲掉）
  const next = normalizeConfig({ ...readFromDisk(), ...patch }, app.getPath('downloads'))
  try {
    mkdirSync(app.getPath('userData'), { recursive: true })
    const tmp = `${configPath()}.tmp`
    writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf-8')
    renameSync(tmp, configPath())
  } catch {
    // 写盘失败时返回内存值，下次操作重试
  }
  return next
}
