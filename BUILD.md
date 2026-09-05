# Pointers-BOX 构建与分发指南

## Windows（本机可完成）

两个目标目录已按要求整理为**解包安装目录**，安装包（NSIS 等）由你自行打包：

```
release\win-x64\win-unpacked\    ← Windows 10/11 x64 版本
release\win7-x64\win-unpacked\   ← Windows 7 x64 版本（Electron 22 运行时）
```

- 入口程序：`Pointers-BOX.exe`（图标已使用官方 `app.ico`）
- 两个目录内容基于同一 Electron 22.3.27 运行时，均兼容 Win7/Win10/Win11 x64
- 重新生成：`pnpm package:win:x64` / `pnpm package:win:win7`
- 自行打包 NSIS 参考：

```powershell
# 以 NSIS 为例（可用自定义向导界面）
makensis /DAPPDIR="D:\Agent\Pointers-BOX\release\win-x64\win-unpacked" installer.nsi
```

## macOS（CI 产出 DMG）

本机为 Windows，DMG 必须在 macOS 上打包（hdiutil 限制），已配置 GitHub Actions：

1. 推送仓库到 GitHub（PointersMZX/Pointers-BOX）
2. 打 tag：`git tag v2.0.0 && git push origin v2.0.0`
3. `release.yml` 会在 macOS runner 产出 `.dmg` 并上传到 GitHub Release

本地如有 Mac：`pnpm package:mac`（输出 `release/*.dmg`，图标已生成 `icon.icns`）

## Linux（CI 产出 deb/AppImage）

同上，`release.yml` 的 ubuntu runner 产出 `deb` + `AppImage`。
本地如需自行构建：`pnpm package:linux`（建议在 Linux 环境执行）。

## Android（CI 产出 APK / 本机需 SDK）

已含 Capacitor 工程（`android/`），两种出包方式：

- **CI（推荐）**：`android.yml` 在推送时自动构建 `assembleRelease`，产出未签名 APK artifact；
  如需签名，在仓库 Secrets 配置 `ANDROID_KEYSTORE_BASE64` 后自动签名
- **本地**：安装 Android Studio + JDK 17 后：

```powershell
pnpm cap:sync
pnpm cap:open   # Android Studio 中 Build → Generate Signed Bundle / APK
```

## 更新发布流程（electron-updater）

1. 修改 `package.json` `version`
2. 打 tag 推送 → `release.yml` 自动发布 GitHub Release（含 latest.yml）
3. 已发布客户端启动 30 秒后自动检查；设置页可手动「检查更新 → 下载更新 → 重启安装」
4. 更新包下载进度会显示在「下载管理」页

## 已知构建环境注意事项

- electron-builder 下载 `winCodeSign` 时若报 `Cannot create symbolic link`：
  用 7za 手动解压 `winCodeSign-2.6.0.7z` 到
  `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign\winCodeSign-2.6.0\`
  （缺失的 2 个 darwin 符号链接不影响 Windows 构建）
- Electron 22 二进制下载慢时已配置 npmmirror（.npmrc）
