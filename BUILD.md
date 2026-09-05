# Pointers-BOX 构建与分发指南

## 发版流程（推荐：打 tag → CI 全平台自动产出）

仓库推送到 GitHub（PointersMZX/Pointers-BOX）后，**打 tag 即自动出全平台包**：

```powershell
git tag v2.0.1
git push origin v2.0.1
```

`release.yml` CI 只负责本机无法构建的平台（**Windows 双版本由维护者本机打包上传**）：

| Job | Runner | 产物 | 说明 |
|-----|--------|------|------|
| desktop/macos | macos-latest | .dmg + latest-mac.yml | 未签名（identity: null），用户首次打开需右键→打开 |
| desktop/ubuntu | ubuntu-latest | .deb + .AppImage | — |

`android.yml` 同 tag 触发：`assembleRelease` 出 APK，自动附加到同一 Release
（配置 `ANDROID_KEYSTORE_BASE64` Secret 则自动签名，否则为未签名 APK）。

> Windows 手工打包说明：应用内"检查更新"仍可检测到新版本（对比 GitHub Release tag），
> 但一键下载安装依赖 Release 里的 latest.yml——手工打包时若想启用自动更新，
> 需用 electron-builder 出 NSIS（会同时生成 latest.yml）并把两者一起上传；
> 仅用 makensis 手打则走"提示新版本 → 用户手动下载"模式。

> 注意：应用内自动更新依赖 Release 里的 latest.yml（由常规版 job 产出）。
> 手工上传安装包的 Release 没有该文件，检查更新会提示"已是最新"——正式发版请走 tag 流程。
> macOS 包未做 Apple 公证，用户首次打开需右键→打开（正式分发建议加 Developer ID 签名 + 公证）。

## Windows（本机可完成）

两个目标目录为**解包安装目录**，安装包（NSIS 等）可自行打包：

```
release\win-x64\win-unpacked\    ← Windows 10/11 x64 版本（Electron 33）
release\win7-x64\win-unpacked\   ← Windows 7 x64 版本（Electron 22）
```

- 入口程序：`Pointers-BOX.exe`（图标为官方 `app.ico`）
- 双版本一条命令重新生成：`pnpm build:win`（即 `node scripts/build-win.mjs`）
- 自行打包 NSIS 参考：

```powershell
makensis /DAPPDIR="D:\Agent\Pointers-BOX\release\win-x64\win-unpacked" installer.nsi
```

## macOS / Linux / Android（本机手动构建备用）

| 平台 | 命令 | 前提 |
|------|------|------|
| macOS | `pnpm package:mac` | 仅限 Mac 机器（hdiutil 限制） |
| Linux | `pnpm package:linux` | 建议 Linux 环境 |
| Android | `pnpm cap:sync && pnpm cap:open` | Android Studio + JDK 17 |

## 开发

```powershell
pnpm install
pnpm dev          # Electron + Vite HMR
pnpm test         # 99 个单测
pnpm typecheck
pnpm test:download  # 下载链路 E2E（需先启动应用并带 --remote-debugging-port=9223）
```

## 已知构建环境注意事项

- electron-builder 下载 `winCodeSign` 时若报 `Cannot create symbolic link`：
  用 7za 手动解压 `winCodeSign-2.6.0.7z` 到
  `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0\`
  （缺失的 2 个 darwin 符号链接不影响 Windows 构建）
- Electron 二进制下载慢时已配置 npmmirror（.npmrc）
- 重打包前关闭所有 Pointers-BOX/electron 进程（app.asar 被占用会导致失败）
