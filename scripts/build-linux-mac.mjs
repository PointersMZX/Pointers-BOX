// v2.6.0：Linux/macOS 桌面包手动组装——app-builder 的 Linux 工具链下载在 Windows 上
// 会被网络卡死（ERR_ELECTRON_BUILDER_CANNOT_EXECUTE），改为：
//   npmmirror 拉 electron 官方 dist zip → 解压 → resources/app.asar（out/** + package.json）
//   + extraResources（icons/ + box.mcx）→ tar.gz（Linux 固定可执行位；mac 拼 .app）
// 产物：release/v<版本>/Pointers-BOX_v<版本>_linux-x64.tar.gz / _macos-x64.tar.gz / _macos-arm64.tar.gz
// electron dist 的具体版本从 node_modules/electron/package.json 读取（与 build-win 的 e33 对齐）。
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = pkg.version
const electronVersion = JSON.parse(readFileSync(join(root, 'node_modules', 'electron', 'package.json'), 'utf8')).version
const outDir = join(root, 'release', `v${version}`)
const tmpBase = join(root, '.build-tmp-lm')
const sevenZip = 'D:\\7-Zip\\7z.exe'
const mirrorBase = 'https://npmmirror.com/mirrors/electron'

function run(cmd, args, opts = {}) {
  console.log(`[build-lm] ${cmd} ${args.join(' ')}`)
  const r = execFileSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32', ...opts })
  return r
}

function download(url, dest) {
  console.log(`[build-lm] 下载 ${url}`)
  // PowerShell BITS 稳定走镜像；curl 在 Git Bash 环境也可用
  execFileSync('powershell', ['-NoProfile', '-Command',
    `[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '${url}' -OutFile '${dest}' -UseBasicParsing`],
    { stdio: 'inherit', shell: false })
}

function extract(zip, dest) {
  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })
  execFileSync(sevenZip, ['x', zip, `-o${dest}`, '-y'], { stdio: 'pipe' })
}

/** 组装 resources：app.asar（package.json + out/**）+ icons/ + box.mcx */
function assembleResources(destResources) {
  mkdirSync(join(destResources, 'app-src'), { recursive: true })
  copyFileSync(join(root, 'package.json'), join(destResources, 'app-src', 'package.json'))
  const asarSrc = join(destResources, 'app-src')
  // out/** 拷入（asar pack 需要真实目录）
  cpDir(join(root, 'out'), join(asarSrc, 'out'))
  // extraResources
  cpDir(join(root, 'resources', 'icons'), join(destResources, 'icons'))
  copyFileSync(join(root, 'resources', 'box.mcx'), join(destResources, 'box.mcx'))
  // asar pack（@electron/asar 由 electron-builder 传递依赖提供）
  const asarJs = join(root, 'node_modules', '@electron', 'asar', 'bin', 'asar.js')
  if (!existsSync(asarJs)) throw new Error('未找到 @electron/asar（先 pnpm install）')
  run(process.execPath, [asarJs, 'pack', asarSrc, join(destResources, 'app.asar')])
  rmSync(asarSrc, { recursive: true, force: true })
}

function cpDir(src, dest) {
  mkdirSync(dest, { recursive: true })
  for (const f of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, f.name)
    const d = join(dest, f.name)
    if (f.isDirectory()) cpDir(s, d)
    else copyFileSync(s, d)
  }
}

/** 打 tar.gz（Linux：固定可执行位；mac：.app 双层结构） */
function tarGz(srcDir, outName) {
  // v2.6.0：GNU tar（git 自带，System32 bsdtar 无 --mode）；-f 参数用相对路径——
  // GNU tar 会把带盘符冒号的路径误判为远程主机（"Cannot connect to D:"）
  const outFile = `release/v${version}/${outName}`
  run(findGnuTar(), ['-czf', outFile, '--mode=755', '--owner=0', '--group=0', '-C', srcDir.replace(/\\/g, '/'), '.'], { cwd: root })
  console.log(`[build-lm] ${outName}: ${statSync(join(outDir, outName)).size} bytes`)
}

/** 运行时探测 GNU tar（git 自带；本机 git 装在 D:\Git） */
function findGnuTar() {
  const candidates = [
    'D:\\Git\\usr\\bin\\tar.exe',
    'C:\\Program Files\\Git\\usr\\bin\\tar.exe',
    'C:\\Program Files (x86)\\Git\\usr\\bin\\tar.exe'
  ]
  for (const c of candidates) if (existsSync(c)) return c
  return 'tar'
}

function buildTarget(platform, arch) {
  const tag = platform === 'linux' ? 'linux-x64' : `macos-${arch}`
  const zipName = `electron-v${electronVersion}-${platform}-${arch}.zip`
  const zipPath = join(tmpBase, zipName)
  if (!existsSync(zipPath)) download(`${mirrorBase}/v${electronVersion}/${zipName}`, zipPath)

  const extractDir = join(tmpBase, `${platform}-${arch}`)
  extract(zipPath, extractDir)

  if (platform === 'linux') {
    // linux-unpacked：dist 根即应用目录（electron 主程序 + resources/）
    assembleResources(join(extractDir, 'resources'))
    tarGz(extractDir, `Pointers-BOX_v${version}_linux-x64.tar.gz`)
  } else {
    // mac：dist 解出 Electron.app —— 放 app.asar/extraResources 进 Contents/Resources/
    const appDir = join(extractDir, 'Electron.app', 'Contents', 'Resources')
    if (!existsSync(appDir)) throw new Error(`未找到 ${appDir}`)
    assembleResources(appDir)
    // 展示名改 Pointers-BOX（Info.plist 是二进制/plist 混合，用 python plistlib 安全改写）
    const plist = join(extractDir, 'Electron.app', 'Contents', 'Info.plist')
    run('python', ['-I', '-c',
      `import plistlib,sys\np='${plist.replace(/\\/g, '/').replace(/'/g, "\\'")}'\nd=plistlib.load(open(p,'rb'))\nd['CFBundleName']='Pointers-BOX'\nd['CFBundleDisplayName']='Pointers-BOX'\nplistlib.dump(d, open(p,'wb'))`])
    tarGz(extractDir, `Pointers-BOX_v${version}_${tag}.tar.gz`)
  }
}

mkdirSync(tmpBase, { recursive: true })
mkdirSync(outDir, { recursive: true })

buildTarget('linux', 'x64')
// macOS 包不在本地构建：electron darwin zip 内 14 个 framework 符号链接需要管理员特权
// 才能解出（Windows 普通权限解压结构断裂不可运行）——mac 产物走 CI desktop.yml 的 mac 任务


rmSync(tmpBase, { recursive: true, force: true })
console.log(`\n[build-lm] 全部完成 → release/v${version}/`)
