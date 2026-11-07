# Pointers-BOX 数据协议（v2.5.0 口径，全端统一实现规格）

> 三端（Avalonia/Kotlin/ArkTS）数据层按本文实现。协议内容与服务器部署完全解耦——服务器只维护 3 个 JSON 的 .mcx 加密形态，应用侧自行拉取解密。

## 1. 数据源（4 路并发拉取）

| 文件 | URL | 顶层结构 | 说明 |
|---|---|---|---|
| resources.mcx | `https://api.pointers-box.cc.cd/box/resources.mcx` | `Resource[]` | 资源列表 |
| announcement.mcx | `https://api.pointers-box.cc.cd/box/announcement.mcx` | `{date, content}` | 平台公告（单条） |
| box.mcx | `https://api.pointers-box.cc.cd/box/box.mcx` | `BoxInfo` | 应用信息（包内嵌入兜底，远程可覆盖） |
| boxbbgxrz.mcx | `https://api.pointers-box.cc.cd/box/boxbbgxrz.mcx` | `VersionLog[]` | 版本更新日志（新→旧） |

- 4 路并发拉取（互不阻塞），**单路失败不影响其他路**（Promise.allSettled 语义）。
- 全部失败 → 离线模式：读本地缓存；无缓存 → 空数据 + 警告。
- 加缓存穿透参数：强制刷新时 URL 追加 `?t=<毫秒时间戳>`。

## 2. 数据模型

```
ShareItem  { name, url }
Resource   { id: number|string, name, introduction, release_date?, last_modified?,
             category, links: string[], shares?: ShareItem[] }
             // links 与 shares 二选一，两者都有时优先 shares
Announcement { date, content }
VersionLog { version, log }
BoxInfo    { app_name, app_introduction, general_key?, developer, community_qq, copyright }
UserLink   { id, name(≤100), url(http/https ≤2048), remark(≤500), createdAt }
AppConfig  { downloadDir, androidBrowser: builtin|system, theme, accent, updateChannel: gitee|github,
             homeLayout: stacked|compact|wide, keepDownloadHistory, ... }
```

## 3. 合并规则

- `box` 信息：**内嵌包内 box.mcx 为底，远程 box.mcx 成功时覆盖**（mergeBoxInfo）。
- 任一路失败用 null 占位 → UI 对应卡降级（公告卡隐藏等）。
- 快照持久化到本地缓存（离线兜底），恢复时标记 `offline: true`。

## 4. .mcx 容器

见 `docs/mcx/mcx-algorithm.md`（三语言实现 `docs/mcx/vectors/` 互验）。

## 5. 更新检查（双渠道）

| 渠道 | 检查 API | 资产 |
|---|---|---|
| Gitee | Gitee Release API（最新 release 的 tag_name） | Windows .exe（仅桌面） |
| GitHub | GitHub Release API | 全平台资产 |

- 检查 = 拉最新 Release 的 `tag_name` 与本地版本比较（semver 新版判定）。
- 版本比较规则：`isNewerVersion(latest, current)`——分段数值比较（v 前缀剥离）。
- 移动端下载引导去发布页（资产不含移动端安装包）。

## 6. 嵌入兜底

包内嵌入 `box.mcx`（构建时由 `box.json` 加密生成，见 scripts/build-mcx.mjs 逻辑，各端打包流程需复刻）：
- 桌面 C#：作为资源嵌入程序集或随包文件
- Android：assets/
- 鸿蒙：rawfile/
