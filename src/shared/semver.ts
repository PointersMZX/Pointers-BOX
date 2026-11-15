// semver 比较（自实现，避免额外依赖）：支持 v 前缀与 -pre.release 标签
export interface ParsedVersion {
  major: number
  minor: number
  patch: number
  pre: string[]
}

const VERSION_RE = /^\s*v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?\s*$/

export function parseVersion(input: string): ParsedVersion | null {
  const m = VERSION_RE.exec(input)
  if (!m) return null
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    // noUncheckedIndexedAccess：正则捕获组存在性由 VERSION_RE 保证
    pre: m[4] ? (m[4] as string).split('.') : []
  }
}

// 预发布比较（semver 规则）：数字段按数值、标识符按字典序、数字段 < 字符串段、短段 < 长段
function comparePre(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 0
  if (a.length === 0) return 1 // 无预发布 > 有预发布
  if (b.length === 0) return -1
  const len = Math.max(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const x = a[i]
    const y = b[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    const nx = /^\d+$/.test(x)
    const ny = /^\d+$/.test(y)
    if (nx && ny) {
      const d = Number(x) - Number(y)
      if (d !== 0) return d < 0 ? -1 : 1
    } else if (nx !== ny) {
      return nx ? -1 : 1 // 数字段 < 字符串段
    } else if (x !== y) {
      return x < y ? -1 : 1
    }
  }
  return 0
}

// 任一版本不可解析时返回 0（视为无差异，避免误报更新）
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  if (!pa || !pb) return 0
  if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1
  if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1
  if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1
  return comparePre(pa.pre, pb.pre)
}

export function isNewerVersion(candidate: string, current: string): boolean {
  return compareVersions(candidate, current) > 0
}

/**
 * 版本跨度（v2.6.0 强制更新判定：跨度 ≥2 时不允许跳过更新）。
 * - 主版本不同：一律按 3 级跨度计（大版本升级必须更新）
 * - 次版本 + 修订号逐级累加：2.4.0→2.6.0 = 2；2.5.0→2.6.1 = 2（含补丁级）；
 *   2.5.0→2.6.0 = 1；2.5.0→2.5.2 = 2
 * - 无法解析、或最新版不高于当前版：0
 */
export function versionDistance(latest: string, current: string): number {
  const a = parseVersion(latest)
  const b = parseVersion(current)
  if (!a || !b) return 0
  if (compareVersions(latest, current) <= 0) return 0
  if (a.major !== b.major) return 3
  const minorGap = Math.max(0, a.minor - b.minor)
  const patchGap = Math.max(0, a.patch - b.patch)
  return minorGap + patchGap
}
