// 下载文件名清洗：Windows 非法字符 / 保留名 / 首尾空白与点
const ILLEGAL_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g
const RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i

export function sanitizeFilename(name: string): string {
  let cleaned = name.replace(ILLEGAL_CHARS, '_')
  cleaned = cleaned.replace(/^[\s.]+/, '').replace(/[\s.]+$/, '')
  // 空名或全部由非法字符替换而来的下划线串 → 回退默认名
  if (cleaned === '' || /^_+$/.test(cleaned)) cleaned = 'download'
  const stem = cleaned.split('.')[0] ?? ''
  if (RESERVED_NAMES.test(stem)) cleaned = `_${cleaned}`
  return cleaned
}
