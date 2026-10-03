// v2.3.2：强刷缓存击穿——静态托管（cc.cd 类）对同一 URL 可能长时间缓存，
// 用户主动刷新（下拉刷新/刷新按钮/重新加载）时追加时间戳参数强制拿到最新内容；
// 后台节流刷新（force=false）不带参数，避免打破 CDN 命中
export function withCacheBust(url: string, ts: number = Date.now()): string {
  if (typeof url !== 'string' || url.length === 0) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}t=${ts}`
}
