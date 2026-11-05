// v2.6.0：Android APK 本地一键构建——对齐 CI（android.yml）流程，
// 修复本地打包旧产物残留问题（cap copy 只覆盖不清空 → index.html 与 JS hash
// 新旧混合 → WebView 加载 404 JS → 纯色屏，v2.5.0 本地产物即此病）。
// 流程：pnpm build → 彻底清空 android assets/public → cap copy → gradle assembleRelease
//       → 产物按版本改名入 release/（5 件：universal + 4 ABI，v2.6.0 splits）。
// 签名：密钥已入库（android/app/pbox-release.keystore），assembleRelease 直接出可安装 APK。
// 环境：JAVA_HOME=D:/java/Java17 + -I mirror-init.gradle（aliyun 镜像绕 GFW，路径必须绝对）。
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, copyFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const androidDir = join(root, 'android')
const assetsPublic = join(androidDir, 'app', 'src', 'main', 'assets', 'public')
const outDir = join(root, 'release')
const mirrorInit = join(androidDir, 'mirror-init.gradle')
const javaHome = process.env.JAVA_HOME_17 ?? 'D:\\java\\Java17'

function fail(msg) {
  console.error(`[build-android] ${msg}`)
  process.exit(1)
}

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version = pkg.version

// 1. 渲染层构建（常规 module 产物，绝不能带 PBOX_HARMONY_BUILD=1——
//    那是鸿蒙 singlefile 专用，会把 out/renderer 清成只剩 index.html）
if (process.env.PBOX_HARMONY_BUILD === '1') {
  fail('检测到 PBOX_HARMONY_BUILD=1（鸿蒙专用构建变量），请先清除再打 Android 包')
}
console.log('[build-android] 渲染层构建中（electron-vite build）…')
execFileSync(process.execPath, [join(root, 'node_modules', 'electron-vite', 'bin', 'electron-vite.js'), 'build'], {
  cwd: root,
  stdio: 'inherit'
})
const rendererSrc = join(root, 'out', 'renderer')
if (!existsSync(join(rendererSrc, 'index.html'))) fail('out/renderer 构建失败')

// 校验渲染层布局：index.html 必须引用 assets/ 下真实存在的 JS（防旧产物混合病）
{
  const html = readFileSync(join(rendererSrc, 'index.html'), 'utf8')
  const refs = [...html.matchAll(/src="(\.\/assets\/[^"]+\.js)"/g)].map((m) => m[1])
  if (refs.length === 0) fail('out/renderer/index.html 没有引用任何 assets/ 下的 JS（疑似 singlefile 版）')
  for (const ref of refs) {
    if (!existsSync(join(rendererSrc, ref))) fail(`index.html 引用的 ${ref} 不存在（构建产物不一致）`)
  }
  console.log(`[build-android] 渲染层布局校验通过（${refs.length} 个 JS 引用全部存在）`)
}

// 2. 彻底清空 assets/public 后重建（cap copy 只覆盖不清空，旧 hash 残留是事故根因）
console.log('[build-android] 清空并重建 assets/public …')
rmSync(assetsPublic, { force: true, recursive: true })
mkdirSync(assetsPublic, { recursive: true })
cpSync(rendererSrc, assetsPublic, { recursive: true })

// cap copy：补 capacitor.config.json / capacitor.plugins.json / cordova 运行时
console.log('[build-android] cap copy android …')
execFileSync('npx', ['cap', 'copy', 'android'], { cwd: root, stdio: 'inherit', shell: true })

// 3. gradle assembleRelease（本地签名；用本地 gradle 8.13，wrapper 会下 zip 被 GFW 拦；
//    gradle.bat 是 cmd 脚本须经 cmd /c 启动；-I 镜像注入路径必须绝对）
const gradleBat = process.env.GRADLE_BAT ?? 'D:\\gradle\\gradle-8.13\\bin\\gradle.bat'
if (!existsSync(gradleBat)) fail(`未找到 gradle.bat：${gradleBat}`)
console.log(`[build-android] gradle assembleRelease（${gradleBat} + aliyun 镜像）…`)
execFileSync(`${process.env.SystemRoot ?? 'C:\\Windows'}\\System32\\cmd.exe`, ['/c', gradleBat, 'assembleRelease', '-I', mirrorInit, '--stacktrace'], {
  cwd: androidDir,
  env: {
    ...process.env,
    JAVA_HOME: javaHome
  },
  stdio: 'inherit'
})

// 4. 产物 → release/（5 件：universal + 4 ABI，按版本改名）
const outputs = join(androidDir, 'app', 'build', 'outputs', 'apk', 'release')
mkdirSync(outDir, { recursive: true })
const apks = readdirSync(outputs).filter((f) => f.endsWith('.apk'))
if (apks.length === 0) fail(`outputs 目录无 APK：${outputs}`)
let count = 0
for (const f of apks) {
  // gradle splits 产物名：app-x86_64-release.apk / app-universal-release.apk …
  const m = f.match(/^app-([a-z0-9_-]+)-release\.apk$/) ?? (f === 'app-release.apk' ? [f, 'universal'] : null)
  if (!m) continue
  const variant = m[1] === 'release' ? 'universal' : m[1]
  const dest = join(outDir, `Pointers-BOX_v${version}_${variant}.apk`)
  copyFileSync(join(outputs, f), dest)
  const mb = Math.round((statSync(dest).size / 1024 / 1024) * 10) / 10
  console.log(`[build-android] 完成 → release/Pointers-BOX_v${version}_${variant}.apk（${mb} MB）`)
  count++
}
if (count === 0) fail('未匹配到任何 APK 产物名（检查 gradle splits 配置）')
console.log(`[build-android] 全部完成：${count} 件 APK`)
