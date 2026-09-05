// 收紧 CI 触发：只匹配 v* / 2* 两种标签命名（'**' 会误匹配分支推送）
import { readFileSync, writeFileSync } from 'node:fs'

for (const f of ['.github/workflows/release.yml', '.github/workflows/android.yml']) {
  let s = readFileSync(f, 'utf8')
  if (!s.includes("- '**'")) {
    console.log(f, '未找到 ** 模式（可能已改），跳过')
    continue
  }
  s = s.replace(
    "- '**'",
    "- 'v*' # v2.0.0-beta 这类\n      - '2*' # 2.0.0Beta 这类（无 v 前缀）"
  )
  writeFileSync(f, s)
  console.log(f, '触发模式已收紧')
}
