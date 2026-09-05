// 自动备份：命名与轮转选择（纯逻辑，fs 操作在 dataStore）

// 备份文件名：{kind}-YYYYMMDD-HHmmss.json.bak（kind: resource / box / boxzzyhs）
export function backupFileName(kind: string, now: Date): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  const stamp =
    `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}` +
    `-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`
  return `${kind}-${stamp}.json.bak`
}

// 从备份文件名解析时间戳（UTC 毫秒）；解析失败返回 null
export function backupTimestamp(name: string): number | null {
  const m = /^.+-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})\.json\.bak$/.exec(name)
  if (!m) return null
  const [, y, mo, d, h, mi, s] = m as unknown as [
    string,
    string,
    string,
    string,
    string,
    string,
    string
  ]
  return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s))
}

// 返回应删除的文件名列表：保留最近 keep 个；时间戳无法解析的最先删除
export function pruneBackupNames(names: string[], keep: number): string[] {
  const scored = names.map((n) => ({ n, t: backupTimestamp(n) ?? -1 }))
  scored.sort((x, y) => y.t - x.t)
  return scored.slice(Math.max(0, keep)).map((s) => s.n)
}
