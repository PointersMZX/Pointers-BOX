// v2.4.0 分享功能（平台绑定分享）：
// 分享文本只带「平台分享页」链接（指向 share.html?id=资源id），资源真实链接
// 只作为分享页内「领取」的跳转目标，不在任何 UI 或分享文本中以文本形式出现。
// 接收方打开分享页 → 回平台领取。纯函数：桌面/Android 双端同源生成，可单测。
import type { Resource } from './types'

/** 平台分享页（与服务器 3 个 JSON 同目录；参考页见仓库 publish/share.html，由维护者上传） */
export const SHARE_PAGE_URL = 'https://pointers-box.cc.cd/box/share.html'

/** 资源的分享链接：平台分享页 + 资源 id（id 统一转字符串并编码，防特殊字符逃逸） */
export function resourceShareUrl(resource: Pick<Resource, 'id'>): string {
  return `${SHARE_PAGE_URL}?id=${encodeURIComponent(String(resource.id))}`
}

/** 分享文本的简介行：取第一个非空行，超 40 字截断加省略号；空简介返回空串（调用方省略该行） */
export function shareIntroLine(introduction?: string | null): string {
  const text = (introduction ?? '').trim()
  if (!text) return ''
  const line = (text.split(/\r?\n/)[0] ?? '').trim()
  return line.length > 40 ? `${line.slice(0, 40)}…` : line
}

/** 资源分享文本（平台绑定：对方拿到的是平台分享页链接，不是资源链接本身） */
export function buildShareText(resource: Resource): string {
  const lines = ['【Pointers资源分享平台】', `资源名称：${resource.name}`]
  const intro = shareIntroLine(resource.introduction)
  if (intro) lines.push(intro)
  lines.push('点击下方链接在平台上领取：', resourceShareUrl(resource))
  return lines.join('\n')
}
