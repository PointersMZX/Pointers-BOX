// 给 CI 工作流注入官方下载源（覆盖 .npmrc 的国内镜像，CI 跨洋访问不稳定）
import { readFileSync, writeFileSync } from 'node:fs'

const files = ['.github/workflows/release.yml', '.github/workflows/android.yml']
const inject = `env:
  # CI 机器走 GitHub 官方源（.npmrc 的国内镜像仅用于本机，跨洋访问不稳定）
  ELECTRON_MIRROR: https://github.com/electron-userland/electron/releases/download/
  NPM_CONFIG_REGISTRY: https://registry.npmjs.org

on:`

for (const f of files) {
  let s = readFileSync(f, 'utf8')
  if (s.includes('ELECTRON_MIRROR')) {
    console.log(f, '已包含，跳过')
    continue
  }
  if (!s.includes('\non:')) {
    console.error(f, '未找到 on: 锚点')
    process.exit(1)
  }
  s = s.replace('\non:', '\n' + inject)
  writeFileSync(f, s)
  console.log(f, '已注入官方下载源')
}
