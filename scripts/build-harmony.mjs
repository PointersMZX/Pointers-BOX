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

// 1. 渲染层产物 → 两个模块的 rawfile/www（整目录同步；手机/PC 双包各带一份渲染层）
const rawfileWwwPc = join(harmonyDir, 'entry-pc', 'src', 'main', 'resources', 'rawfile', 'www')
for (const www of [rawfileWww, rawfileWwwPc]) {
  rmSync(www, { force: true, recursive: true })
  mkdirSync(dirname(www), { recursive: true })
  cpSync(rendererSrc, www, { recursive: true })
}
console.log(`[build-harmony] 渲染层已同步 → entry + entry-pc 的 rawfile/www`)

// 2. hvigor 构建（内嵌 node + wrapper；PATH 补 System32 供 es2abc spawn cmd.exe）
// 双 product：phone（entry 模块，phone/tablet）+ pc（entry-pc 模块，2in1 鸿蒙 PC）
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = pkg.version
const env = {
  ...process.env,
  DEVECO_SDK_HOME: sdkHome,
  PATH: `${process.env.SystemRoot ?? 'C:\\Windows'}\\System32;${process.env.PATH ?? ''}`
}
const outDir = join(root, 'release')
mkdirSync(outDir, { recursive: true })
// 清理旧命名产物（单包时代 harmony-signed/unsigned）
for (const old of ['signed', 'unsigned']) {
  rmSync(join(outDir, `Pointers-BOX_v${pkg.version}_harmony-${old}.hap`), { force: true })
}

const products = [
  // 手机/平板：entry 模块 + default product（hvigor 要求 default product 存在，
  // 自定义 product 名会出现 "Unable to find or load the default product"）
  { product: 'default', target: 'default', moduleDir: 'entry', moduleName: 'entry', suffix: 'phone' },
  // 鸿蒙 PC（2in1）：entry-pc 模块 + pc product；模块 target 必须改名 pc（与 entry 的 target 同名会互相干扰）
  { product: 'pc', target: 'pc', moduleDir: 'entry-pc', moduleName: 'entrypc', suffix: 'pc' }
]

for (const { product, target, moduleDir, moduleName, suffix } of products) {
  console.log(`[build-harmony] hvigor 构建中 product=${product}（SDK=${sdkHome}）…`)
  execFileSync(nodeExe, [
    hvigorwJs,
    '--mode', 'module',
    '-p', `module=${moduleName}@${target}`,
    '-p', `product=${product}`,
    '-p', 'buildMode=release',
    'assembleHap',
    '--no-daemon'
  ], { cwd: harmonyDir, env, stdio: 'inherit' })

  // 3. 产物 → release/（签名版优先）
  const outputs = join(harmonyDir, moduleDir, 'build', target, 'outputs', target)
  let hapSrc = join(outputs, `${moduleName}-${target}-signed.hap`)
  if (!existsSync(hapSrc)) hapSrc = join(outputs, `${moduleName}-${target}-unsigned.hap`)
  if (!existsSync(hapSrc)) {
    // 兜底：不同 hvigor 版本目录结构差异，扫模块 build 下任意 hap
    const { readdirSync } = await import('node:fs')
    hapSrc = findHap(readdirSync, join(harmonyDir, moduleDir, 'build')) ?? ''
  }
  if (!existsSync(hapSrc)) fail(`product=${product} 未找到构建产物 hap`)
  const isSigned = hapSrc.includes('signed')
  const tag = isSigned ? 'signed' : 'unsigned'
  const outPath = join(outDir, `Pointers-BOX_v${version}_harmony-${suffix}-${tag}.hap`)
  rmSync(join(outDir, `Pointers-BOX_v${version}_harmony-${suffix}-signed.hap`), { force: true })
  rmSync(join(outDir, `Pointers-BOX_v${version}_harmony-${suffix}-unsigned.hap`), { force: true })
  cpSync(hapSrc, outPath)
  const mb = Math.round((statSync(outPath).size / 1024 / 1024) * 10) / 10
  console.log(`[build-harmony] 完成 → release/Pointers-BOX_v${version}_harmony-${suffix}-${tag}.hap（${mb} MB）`)
}

function findHap(readdirSync, dir) {
  try {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, name.name)
      if (name.isDirectory()) {
        const hit = findHap(readdirSync, full)
        if (hit) return hit
      } else if (/\.hap$/.test(name.name)) {
        return full
      }
    }
  } catch { /* 无权限忽略 */ }
  return null
}
