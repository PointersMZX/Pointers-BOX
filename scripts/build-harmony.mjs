// v2.6.0：鸿蒙 HAP 构建脚本——渲染层专用构建（iife）+ hvigor 命令行构建（无 IDE GUI）。
// 前置：DevEco Studio 安装（默认 D:\DevEco Studio，可用 DEVECO_HOME 覆盖）。
// 签名：build-profile.json5 的 signingConfigs（DevEco 自动签名生成，需模拟器/真机在线一次性生成）；
//       有签名配置时 hvigor 直接出 entry-default-signed.hap，无则出 unsigned。
// 产物：release/Pointers-BOX_v{版本}_harmony-signed.hap（或 -unsigned.hap）
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
const rawfileWww = join(harmonyDir, 'entry', 'src', 'main', 'resources', 'rawfile', 'www')

function fail(msg) {
  console.error(`[build-harmony] ${msg}`)
  process.exit(1)
}

if (!existsSync(nodeExe) || !existsSync(hvigorwJs)) {
  fail(`未找到 DevEco 工具链：${ideHome}（可用 DEVECO_HOME 环境变量指定安装目录）`)
}

// 0. 渲染层专用构建（iife 单 chunk，绕开 ArkWeb resource:// 的 module CORS 拦截）
const electronViteJs = join(root, 'node_modules', 'electron-vite', 'bin', 'electron-vite.js')
if (!existsSync(electronViteJs)) fail('未找到 electron-vite（先 pnpm install）')
console.log('[build-harmony] 渲染层构建中（PBOX_HARMONY_BUILD=1，iife 单 chunk）…')
execFileSync(process.execPath, [electronViteJs, 'build'], {
  cwd: root,
  env: { ...process.env, PBOX_HARMONY_BUILD: '1' },
  stdio: 'inherit'
})
const rendererSrc = join(root, 'out', 'renderer')
if (!existsSync(rendererSrc)) fail('渲染层构建失败：out/renderer 不存在')

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

// 3. 产物 → release/（签名版优先）
const outputs = join(harmonyDir, 'entry', 'build', 'default', 'outputs', 'default')
const signedHap = join(outputs, 'entry-default-signed.hap')
const unsignedHap = join(outputs, 'entry-default-unsigned.hap')
const hapSrc = existsSync(signedHap) ? signedHap : unsignedHap
if (!existsSync(hapSrc)) fail('未找到构建产物 entry-default-*.hap')
const suffix = hapSrc === signedHap ? 'signed' : 'unsigned'
const outDir = join(root, 'release')
mkdirSync(outDir, { recursive: true })
const outPath = join(outDir, `Pointers-BOX_v${version}_harmony-${suffix}.hap`)
rmSync(join(outDir, `Pointers-BOX_v${version}_harmony-signed.hap`), { force: true })
rmSync(join(outDir, `Pointers-BOX_v${version}_harmony-unsigned.hap`), { force: true })
cpSync(hapSrc, outPath)
const mb = Math.round((statSync(outPath).size / 1024 / 1024) * 10) / 10
console.log(`[build-harmony] 完成 → release/Pointers-BOX_v${version}_harmony-${suffix}.hap（${mb} MB）`)
if (suffix === 'unsigned') {
  console.log('[build-harmony] 未签名：侧载前用 HOKIT/hapsigntool 重签名（见 v2.6.0 研究报告 §5.4）')
}
