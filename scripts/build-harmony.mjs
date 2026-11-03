// v2.6.0：鸿蒙 HAP 构建脚本——渲染层产物同步 + hvigor 命令行构建（无 IDE GUI）。
// 前置：pnpm build（out/renderer）+ DevEco Studio 安装（默认 D:\DevEco Studio，可用 DEVECO_HOME 覆盖）。
// 产物：release/Pointers-BOX_v{版本}_harmony-unsigned.hap（未签名，侧载时由 HOKIT/hapsigntool 重签名）
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const ideHome = process.env.DEVECO_HOME ?? 'D:\\DevEco Studio'
const nodeExe = join(ideHome, 'tools', 'node', 'node.exe')
const hvigorwJs = join(ideHome, 'tools', 'hvigor', 'bin', 'hvigorw.js')
const sdkHome = join(ideHome, 'sdk')
const harmonyDir = join(root, 'harmony')
const rendererSrc = join(root, 'out', 'renderer')
const rawfileWww = join(harmonyDir, 'entry', 'src', 'main', 'resources', 'rawfile', 'www')

function fail(msg) {
  console.error(`[build-harmony] ${msg}`)
  process.exit(1)
}

if (!existsSync(nodeExe) || !existsSync(hvigorwJs)) {
  fail(`未找到 DevEco 工具链：${ideHome}（可用 DEVECO_HOME 环境变量指定安装目录）`)
}
if (!existsSync(rendererSrc)) {
  fail('out/renderer 不存在，请先执行 pnpm build')
}

// 1. 渲染层产物 → rawfile/www（整目录同步）
rmSync(rawfileWww, { force: true, recursive: true })
mkdirSync(dirname(rawfileWww), { recursive: true })
cpSync(rendererSrc, rawfileWww, { recursive: true })
console.log(`[build-harmony] 渲染层已同步 → rawfile/www`)

// 2. hvigor 构建（内嵌 node + wrapper；PATH 补 System32 供 es2abc spawn cmd.exe）
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = pkg.version
const env = {
  ...process.env,
  DEVECO_SDK_HOME: sdkHome,
  PATH: `${process.env.SystemRoot ?? 'C:\\Windows'}\\System32;${process.env.PATH ?? ''}`
}
console.log(`[build-harmony] hvigor 构建中（SDK=${sdkHome}）…`)
execFileSync(nodeExe, [
  hvigorwJs,
  '--mode', 'module',
  '-p', 'module=entry@default',
  '-p', 'product=default',
  '-p', 'buildMode=release',
  'assembleHap',
  '--no-daemon'
], { cwd: harmonyDir, env, stdio: 'inherit' })

// 3. 产物 → release/（统一命名；未签名）
const hapSrc = join(harmonyDir, 'entry', 'build', 'default', 'outputs', 'default', 'entry-default-unsigned.hap')
if (!existsSync(hapSrc)) fail('未找到构建产物 entry-default-unsigned.hap')
const outDir = join(root, 'release')
mkdirSync(outDir, { recursive: true })
const outPath = join(outDir, `Pointers-BOX_v${version}_harmony-unsigned.hap`)
rmSync(outPath, { force: true })
cpSync(hapSrc, outPath)
const mb = Math.round((statSync(outPath).size / 1024 / 1024) * 10) / 10
console.log(`[build-harmony] 完成 → release/Pointers-BOX_v${version}_harmony-unsigned.hap（${mb} MB，未签名）`)
console.log('[build-harmony] 侧载：HOKIT/hapsigntool 重签名后 hdc install（见 v2.6.0 研究报告 §5.4）')
