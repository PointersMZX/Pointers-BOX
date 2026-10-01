// v2.3.1：box.json 包内嵌入兜底值（双端共用的 JS 常量版，与 resources/box.json 同步维护）
// - 桌面端：主进程优先读包内文件（process.resourcesPath/box.json），文件缺失时回落到本常量
// - Android 端（Capacitor，无 node 文件系统）：直接用本常量做字段级兜底
// 保证「关于应用」的通用密钥/应用简介等信息项在双端永远有值可显示（不依赖网络）。
import type { BoxInfo } from './types'

export const EMBEDDED_BOX: BoxInfo = {
  app_name: 'Pointers-BOX',
  app_introduction: 'Pointers资源分享平台',
  general_key: 'zycx（自研项目默认使用项目名称）',
  developer: 'Pointers',
  community_qq: '335753296',
  copyright: 'Copyright © 2026 Pointers-BOX All Rights Reserved'
}
