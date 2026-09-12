// v2.1.0 更新元数据生成器：为自行制作的 NSIS 安装包生成 electron-updater 所需的 latest.yml。
// 用法（在项目根目录）：
//   node scripts/make-update-meta.mjs <安装包路径> [--win7] [--out <目录>]
// 示例：
//   node scripts/make-update-meta.mjs release/install/Pointers-BOX_Setup_v2.1.0_x64.exe            # → ./latest.yml
//   node scripts/make-update-meta.mjs release/install/Pointers-BOX_Setup_v2.1.0_Win7_x64.exe --win7  # → ./latest-win7.yml
//
// 说明：GitHub 渠道的 electron-updater 从 Release 资产里拉 latest.yml（win7 channel 拉 latest-win7.yml）。
// 发布时把这个 yml 与安装包一起上传到 GitHub Release（Gitee 同名版本也建议传一份，虽然 Gitee 渠道下载走附件直链）。
// 生成后请把 yml 里的 url 字段核对/改为 Release 实际下载地址（默认填 GitHub Releases 模板）。
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join, resolve } from 'node:path'
import { argv, cwd } from 'node:process'

function fail(msg) {
  console.error(`[错误] ${msg}`)
  process.exit(1)
}

const args = argv.slice(2)
const win7 = args.includes('--win7')
const outIdx = args.indexOf('--out')
const outDir = outIdx >= 0 ? (args[outIdx + 1] ?? '.') : '.'
const target = args.find((a) => !a.startsWith('--') && a !== (outIdx >= 0 ? args[outIdx + 1] : null))

if (!target || !existsSync(target)) {
  fail('请传入安装包路径：node scripts/make-update-meta.mjs <Setup.exe> [--win7] [--out <目录>]')
}
if (extname(target).toLowerCase() !== '.exe') fail('只支持 .exe 安装包')

const pkg = JSON.parse(readFileSync(join(cwd(), 'package.json'), 'utf8'))
const version = pkg.version
const fileName = basename(target)
const size = readFileSync(target).length
const sha512 = createHash('sha512').update(readFileSync(target)).digest('base64')

// GitHub Release 资产下载模板（发布后即为直链；Gitee 渠道不走此 url）
const url = `https://github.com/PointersMZX/Pointers-BOX/releases/download/v${version}/${encodeURIComponent(fileName)}`

// electron-updater 元数据（NSIS 安装包 + 无差分更新 → 不含 blockmap）
const yml = [
  `version: ${version}`,
  `files:`,
  `  - url: ${fileName}`,
  `    sha512: ${sha512}`,
  `    size: ${size}`,
  `path: ${fileName}`,
  `sha512: ${sha512}`,
  `releaseDate: '${new Date().toISOString()}'`,
  ``
].join('\n')

const outName = win7 ? 'latest-win7.yml' : 'latest.yml'
const outPath = resolve(outDir, outName)
writeFileSync(outPath, yml, 'utf-8')

console.log(`已生成 ${outPath}`)
console.log(`  安装包：${fileName}`)
console.log(`  版本：${version}${win7 ? '（win7 兼容通道）' : ''}`)
console.log(`  大小：${size} bytes`)
console.log(`  sha512：${sha512.slice(0, 16)}…`)
console.log(`\n发布清单（GitHub Release v${version}）：`)
console.log(`  1. ${fileName}（安装包本身）`)
console.log(`  2. ${outName}（本文件，勿改名）`)
if (win7) {
  console.log(`  3. 另外记得标准通道也生成一份：去掉 --win7 再跑一次`)
}
console.log(`\n注意：yml 内 url 已填 GitHub 模板直链，如实际资产名不同请修正。`)
