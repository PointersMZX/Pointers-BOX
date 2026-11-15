# Pointers-BOX

Pointers-BOX 是「Pointers资源分享平台」的官方资源领取客户端，支持 Windows、Linux、macOS 电脑，Android 手机，以及鸿蒙手机/PC。打开应用即可浏览平台统一发布的资源，一键领取资源链接，全程免费。

## 关于平台

Pointers资源分享平台（[pointers-box.cc.cd](https://pointers-box.cc.cd/)）由作者 Pointers 运营，以统一资源库的形式发布优质资源。客户端与平台网站同源，资源与公告由平台统一管理。

- **完全免费**：软件与资源均不收取任何费用，没有卡密、会员、付费解锁。
- **无需注册登录**：下载即用，不要求账号。
- **不收集个人信息**：软件不会收集你的任何个人数据。

## 主要功能

| 功能 | 说明 |
| --- | --- |
| 资源库 | 浏览平台发布的资源，支持分类筛选、关键词搜索、多种排序，点击资源领取分享链接 |
| 首页 | 今日随机推荐、平台公告（重要更新启动弹窗提醒）、版本日志（点击进内页查看完整日志）、快捷入口 |
| 链接管理 | 保存你自己常用的资源链接，跨重启保留，可一键打开 |
| 首启引导 | 新安装分步配置（外观→强调色→下载路径→浏览器偏好→下载历史→更新渠道） |
| 用户设置 | 顶部卡片展示，点击进入内页修改（用户名/状态/签名/头像），本地保存不上传 |
| 主题外观 | 浅色/深色双主题，强调色两主题通用，玻璃零染色纯光学效果，侧栏与底栏统一折射 |
| 更新检查 | 启动自动检测，强制更新弹窗，更新模式（稳定版/测试版），网盘手动下载 |
| 下载管理 | Windows 端可在应用内管理下载任务（Android 端在系统浏览器内下载） |

## 下载与安装

从 [GitHub Releases 页面](https://github.com/PointersMZX/Pointers-BOX/releases) 下载最新版：

| 平台 | 文件 | 说明 |
| --- | --- | --- |
| Windows 10 / 11 | `Pointers-BOX_Setup_vX.X.X x64.exe` | 标准版安装包 |
| Windows 7 / 8 | `Pointers-BOX_Setup_vX.X.X_Windows7 x64.exe` | Win7 兼容版安装包 |
| Android | `Pointers-BOX_vX.X.X.apk` | 安卓安装包（X.X.X 为版本号） |
| Linux | `Pointers-BOX_vX.X.X.AppImage` / `Pointers-BOX_vX.X.X_amd64.deb` | AppImage 免安装通用版 / deb 安装包（Ubuntu 20.04 / Debian 11 等现代发行版） |
| macOS | `Pointers-BOX_vX.X.X_{arm64,x64}.dmg` | 苹果芯片 / Intel 芯片安装包 |
| 鸿蒙 | `Pointers-BOX_vX.X.X_harmony-phone-signed.hap` / `Pointers-BOX_vX.X.X_harmony-pc-signed.hap` | 鸿蒙手机 / 鸿蒙 PC 安装包 |

- Windows：运行安装程序按向导完成安装即可。
- Android：允许"未知来源"后安装 APK 即可使用。
- Linux（AppImage）：下载后执行 `chmod +x Pointers-BOX_vX.X.X.AppImage` 赋予执行权限，再双击或命令行运行即可。Linux（deb）：`sudo dpkg -i Pointers-BOX_vX.X.X_amd64.deb` 安装。
- macOS：打开 dmg 将应用拖入"应用程序"后——**首次打开会被安全提示拦截**：Intel 芯片在应用图标上**右键 → 打开**，再点"打开"即可；**Apple 芯片（M 系列）会提示"已损坏"**，需在终端执行一次：

  ```
  xattr -cr /Applications/Pointers-BOX.app
  ```

  之后即可正常打开使用。
- 鸿蒙：手机/PC 分别安装对应 HAP 文件（通过 hdc 命令行或华为应用市场安装）。

## 更新

- **Windows**：应用启动后自动检测新版本，有重大更新时弹窗提示强制更新；也可在设置页手动检查，或通过「网盘更新」按钮手动下载。更新模式可选稳定版或测试版（测试版接受正式版与 Pre releases）。
- **Android**：应用内检查到新版本后，按提示打开 Release 页面，下载新 APK 覆盖安装即可。
- **Linux / macOS**：应用内可检查新版本，请到 Release 页面下载新安装包替换（macOS 替换后若再遇"已损坏"提示，重新执行一次上述 `xattr` 命令即可）。
- **鸿蒙**：应用内检查到新版本后，到 Release 页面下载新 HAP 文件，通过 hdc 命令行或华为应用市场覆盖安装即可。

## 社区与反馈

- 社区 QQ 群：`335753296`
- 投稿与咨询：`466620751@qq.com`
- 使用遇到问题：加入上方「社区 QQ 群」或发邮件至「投稿与咨询」反馈

## 版权声明

Copyright © 2026 Pointers-BOX All Rights Reserved

本仓库为 Pointers-BOX 客户端的源码仓库。软件与资源均完全免费：若有任何人（自称作者、平台客服或第三方渠道）以 Pointers-BOX 的名义向你收费、索要卡密或引导购买，均为冒充诈骗，请勿付款，并可通过【社区与反馈】向作者核实。