// 双版本打包脚本：win-x64（Electron 33）+ win7-x64（Electron 22）
// 产物输出到 release/win-x64 与 release/win7-x64
// 用法：node scripts/build-win.mjs
import { spawnSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  rmSync,
  cpSync,
  statSync,
  readFileSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'

const base = process.cwd()
const tmpBase = join(base, '.build-tmp')
const releaseDir = join(base, 'release')
const PKG = join(base, 'package.json')

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: base, stdio: 'pipe', encoding: 'utf-8', shell: true })
  if (r.stdout) process.stdout.write(r.stdout)
  if (r.stderr) process.stderr.write(r.stderr)
  return r.status === 0
}

function rmDir(d) {
  if (existsSync(d)) {
    try { rmSync(d, { recursive: true, force: true }) } catch (e) { console.warn(`[warn] 无法删除 ${d}: ${e.message}`) }
  }
}

function copyTree(src, dst) {
  cpSync(src, dst, { recursive: true })
}

const origPkg = readFileSync(PKG, 'utf-8')

function buildVersion(electronVersion, outName) {
  console.log(`\n=== 构建 ${outName}（Electron ${electronVersion}）===`)
  const pkg = JSON.parse(origPkg)
  pkg.devDependencies.electron = `^${electronVersion}.0.0`
  writeFileSync(PKG, JSON.stringify(pkg, null, 2))
  try {
    if (!run('pnpm', ['install', '--no-frozen-lockfile'])) return false
    if (!run('pnpm', ['exec', 'electron-vite', 'build'])) return false
    const outPath = join(tmpBase, outName)
    rmDir(outPath)
    if (!run('pnpm', ['exec', 'electron-builder', '--config', 'electron-builder.yml', '--dir', '--x64', `-c.directories.output=${outPath}`])) return false
    const exe = join(outPath, 'win-unpacked', 'Pointers-BOX.exe')
    if (!existsSync(exe)) {
      console.error(`未找到 ${exe}`)
      return false
    }
    console.log(`${outName}: ${statSync(exe).size} bytes`)
    return true
  } finally {
    // 恢复 package.json 与依赖
    writeFileSync(PKG, origPkg)
    run('pnpm', ['install', '--no-frozen-lockfile'])
  }
}

const ok33 = buildVersion(33, 'win-33')
const ok22 = ok33 ? buildVersion(22, 'win-22') : false

if (!ok33 || !ok22) {
  console.error('\n构建失败')
  process.exit(1)
}

console.log('\n=== 输出到 release/ ===')
rmDir(join(releaseDir, 'win-x64'))
rmDir(join(releaseDir, 'win7-x64'))
mkdirSync(releaseDir, { recursive: true })
copyTree(join(tmpBase, 'win-33', 'win-unpacked'), join(releaseDir, 'win-x64'))
copyTree(join(tmpBase, 'win-22', 'win-unpacked'), join(releaseDir, 'win7-x64'))
rmDir(tmpBase)

const e33 = statSync(join(releaseDir, 'win-x64', 'Pointers-BOX.exe'))
const e22 = statSync(join(releaseDir, 'win7-x64', 'Pointers-BOX.exe'))
console.log(`\nwin-x64（Electron 33）: ${e33.size} bytes`)
console.log(`win7-x64（Electron 22）: ${e22.size} bytes`)
console.log('全部完成')
