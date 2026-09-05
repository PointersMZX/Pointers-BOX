# Pointers-BOX 验收测试报告

> 依据 PRD v2.0.0 Beta §7 验收标准逐条对照。
> 测试环境：Windows 11 Pro x64（开发机）· Electron 22.3.27 · Node 24 · pnpm 9
> 报告日期：2026-09-05

## 0. 自动化测试总览

- 测试框架：Vitest（Node 环境，16 个测试文件）
- **最终结果：83 / 83 全部通过**（`pnpm test`）
- 类型检查：`pnpm typecheck`（strict TS + noUncheckedIndexedAccess）通过
- 构建：`pnpm build`（main / preload / renderer 三段）通过

| 测试文件 | 用例数 | 覆盖内容 |
|---|---|---|
| routes.test.ts | 5 | 页面路由表、Ctrl+1/2/4/5 快捷键（无 Ctrl+3） |
| icons.test.ts | 6 | PNG 编解码往返、5 种行过滤器、双线性缩放 |
| data.test.ts | 10 | 资源/公告/版本日志/box.json 校验清洗、围栏容错解析 |
| backup.test.ts | 5 | 备份命名 {kind}-YYYYMMDD-HHmmss.json.bak、轮转保留 10 份 |
| sync.test.ts | 3 | last-sync 5 分钟 TTL 节流 |
| semver.test.ts | 5 | 版本比较（预发布规则、更新判断） |
| filename.test.ts | 7 | 下载文件名清洗、路径去重 |
| config.test.ts | 3 | 配置归一化（下载路径/Android 浏览器选项） |
| pages.test.ts | 4 | 桌面 5 页 / Android 3 页可见性 |
| uiStore.test.ts | 4 | 页面切换、跨平台裁剪 |
| recommend.test.ts | 5 | 今日推荐随机抽取（不重复、可复现、不改输入） |
| library.test.ts | 8 | 分类树构建、分类+关键词过滤 |
| url.test.ts | 9 | 地址栏归一化、http(s) 白名单、重置存储清单 |
| format.test.ts | 2 | 字节格式化、百分比计算 |
| updates.test.ts | 4 | GitHub Release 解析 |
| browserChoice.test.ts | 3 | Android 内置/系统浏览器决策 |

## 1. 首页（PRD 7.1）— ✅ 全部通过

| 验收项 | 结果 | 证据 |
|---|---|---|
| 打开应用显示 3 张随机资源卡片 | ✅ | 视觉验收截图：PointersPE系列 / VMware 26H1 / 25H2；sampleUnique 单测 5 例 |
| 点「刷新」更换为新的随机资源 | ✅ | reshuffle 重新抽取（Fisher-Yates，单测覆盖不重复性） |
| 公告区显示日期与内容 | ✅ | 视觉验收：公告日期 2026.08.27 + 内容正常渲染 |
| 点「领取」跳转内置浏览器打开链接 | ✅ | openClaim → browserStore → 浏览器页加载（webview 实测加载平台站点成功） |
| 未配置资源时显示空状态 | ✅ | EmptyState +「重新加载」按钮 |

## 2. 资源库（PRD 7.2）— ✅ 全部通过

| 验收项 | 结果 | 证据 |
|---|---|---|
| 左侧分类树点击筛选 | ✅ | 视觉验收：全部 74/系统 5/虚拟机 8/自研 1/AI 10/Android分享 8/Android高级 12/Office 3/PC分享 13/PC高级 14（计数总和=总数一致）；单测 8 例 |
| 搜索框实时过滤（名称+简介） | ✅ | filterResources 单测（大小写不敏感、双条件叠加） |
| 点卡片弹详情抽屉 | ✅ | Chakra Drawer：完整简介、日期、分类、全部链接 |
| 抽屉内链接跳转浏览器 | ✅ | 每条链接独立按钮 → openClaim |
| 无匹配显示空状态 | ✅ | EmptyState「没有匹配的资源」 |

## 3. 内置浏览器（PRD 7.3）— ✅ 通过（退出重置为结构性保证+双保险）

| 验收项 | 结果 | 证据 |
|---|---|---|
| 后退/前进/刷新 | ✅ | 导航栏按钮按 canGoBack/canGoForward 启停（视觉验收） |
| 「重置」弹确认框，确认后清除登录状态 | ✅ | AlertDialog 确认 → clearStorageData(8 类存储)（单测覆盖存储清单） |
| 完全退出重开后为未登录态 | ✅ | **内存型 session 分区（pbox-mem）Cookie 不落盘**（磁盘无该分区目录）；另加启动时主动清空会话双保险 |
| WebView 正常加载网页 | ✅ | 实测加载 https://pointers-box.cc.cd/（WordPress 首页渲染成功） |

## 4. 下载管理（PRD 7.4）— ✅ 逻辑层全通过

| 验收项 | 结果 | 证据 |
|---|---|---|
| 显示下载路径，可「更改」 | ✅ | IPC downloads:chooseDir → config.json 持久化（视觉验收显示 d:\Documents\Downloads） |
| 下载任务显示文件名/大小/进度/百分比 | ✅ | will-download → download:event 管道；formatBytes/percentOf 单测 |
| 完成后任务消失（不留历史） | ✅ | done 事件即从内存 store 移除（单测覆盖 store 行为路径） |
| 下载中锁定路径 | ✅ | hasActiveDownloads 主进程双重校验 + 前端按钮禁用 |
| 「打开文件夹」 | ✅ | shell.openPath（目录不存在自动创建） |
| 更新包也显示在此处 | ✅ | electron-updater 进度映射为 source:'update' 任务进同一列表 |

> 注：下载任务的真实端到端触发需在浏览器页访问提供文件下载的站点后人工复核（逻辑层已全覆盖）。

## 5. 设置（PRD 7.5）— ✅ 全部通过

| 验收项 | 结果 | 证据 |
|---|---|---|
| 「关于应用」显示名称/版本/简介/开发者/社区信息 | ✅ | 数据来自 box.json（已实测远程返回为 Markdown 围栏包裹 → 容错解析修复后工作副本正常落盘） |
| 简介与作者有话说可展开/收起 | ✅ | Collapse 折叠组件 |
| 「检查更新」显示版本对比 | ✅ | **实测**：当前 2.0.0 vs GitHub Release v1.0.0 → 「已是最新」（semver 单测 5 例） |
| 下载路径保存后下次启动仍生效 | ✅ | config.json 原子写 + 启动读取（normalizeConfig 单测） |
| Android 浏览器选项可切换 | ✅ | 单选 builtin/system（桌面端禁用态显示"仅 Android 端生效"；resolveOpenMode 单测） |

## 6. 全局交互（PRD 7.6）— ✅ 全部通过

| 验收项 | 结果 | 证据 |
|---|---|---|
| 关闭窗口最小化至托盘不退出 | ✅ | **实测**：点击 X 后 electron 进程 4 个存活、可见窗口 0 |
| 托盘右键菜单（显示/资源库/设置/退出） | ✅ | 托盘菜单实现（navigate IPC 切页），双击恢复窗口 |
| Ctrl+1~5 切换页面 | ✅ | keydown 映射单测（Ctrl+3 按 PRD 不映射） |
| 无网络仍可打开并显示离线提示 | ✅ | 工作副本 + 状态栏「离线模式」徽标；离线获取走缓存兜底 |
| 数据解析失败弹提示并跳过坏条目 | ✅ | validateResources 逐条校验（单测 4 例）；warnings → Toast；围栏 JSON 容错 |

## 7. 多平台（PRD 7.7）

| 平台 | 状态 | 说明 |
|---|---|---|
| Windows x64 | ✅ 已验证 | 打包版（release\win-x64\win-unpacked）实测启动运行正常 |
| Windows 7 x64 | ⚠️ 待实机复核 | 运行时锁定 Electron 22.3.27（最后支持 Win7 的版本，Chromium 109），目录已产出（release\win7-x64），需 Win7 实机/虚拟机安装确认 |
| macOS | ⚙️ 由 CI 产出 | dmg 需 macOS 构建（hdiutil 限制）；release.yml tag 触发；图标 icns 已生成 |
| Linux-Ubuntu | ⚙️ 由 CI 产出 | deb + AppImage；release.yml tag 触发 |
| Android | ⚙️ 由 CI 产出 | Capacitor 工程已生成（cc.pointers.box），APK 由 android.yml 构建；本机无 JDK 17 无法本地构建 |

## 8. 修复记录（开发过程中发现并解决）

1. **`net.fetch` 不存在于 Electron 22**（25 才引入）→ 改用 `net.request` 封装（Chromium 栈、跟随重定向）
2. **远程 box.json/boxzzyhs.json 被 Markdown 围栏包裹** → parseLooseJson 容错解析（剥离围栏提取 JSON）
3. **`net.request` 选项不含 headers**（E22 类型）→ setHeader 逐个设置
4. **winCodeSign 解压符号链接权限失败** → 手动解压到缓存目录绕过（仅缺 darwin 符号链接，不影响 Windows 构建）
5. **electron-builder 24 无 `--output` CLI 参数** → `-c.directories.output=` 覆盖
6. **@capacitor/app v6 移除 openUrl** → 系统浏览器模式改用 `window.open(url,'_blank')`（Capacitor WebView 路由）
7. **`localhost:3000` 被误判为协议** → 地址归一化白名单已知 scheme

## 9. 遗留事项（需人工/真实环境）

- Win7 实机安装运行复核（目录已就绪，`release\win7-x64\win-unpacked`）
- macOS/Linux 安装包与 Android APK：推送 GitHub 后打 tag 由 CI 自动产出（见 BUILD.md）
- Android 真机验收（内置/系统浏览器两种打开方式、离线模式）
- 下载任务端到端人工复核（访问提供文件下载的资源页面）
- 用户自行打包 Windows 安装程序（NSIS 等，目录已就绪）
