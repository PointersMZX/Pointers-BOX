import { backupFileName, backupTimestamp, pruneBackupNames } from '../src/main/data/backup'

describe('备份命名与轮转（PRD 6.3）', () => {
  it('文件名格式 {kind}-YYYYMMDD-HHmmss.json.bak', () => {
    expect(backupFileName('resource', new Date(2026, 8, 4, 7, 8, 9))).toBe(
      'resource-20260904-070809.json.bak'
    )
    expect(backupFileName('box', new Date(2026, 0, 1, 23, 59, 5))).toBe(
      'box-20260101-235905.json.bak'
    )
  })

  it('从文件名解析时间戳', () => {
    expect(backupTimestamp('resource-20260904-070809.json.bak')).toBe(
      Date.UTC(2026, 8, 4, 7, 8, 9)
    )
    expect(backupTimestamp('random.txt')).toBeNull()
  })

  it('轮转保留最近 10 个，旧的被删除', () => {
    const names: string[] = []
    for (let d = 1; d <= 12; d++) {
      const dd = String(d).padStart(2, '0')
      names.push(`resource-202609${dd}-000000.json.bak`)
    }
    const toDelete = pruneBackupNames(names, 10)
    expect(toDelete).toHaveLength(2)
    expect(toDelete).toContain('resource-20260901-000000.json.bak')
    expect(toDelete).toContain('resource-20260902-000000.json.bak')
    expect(toDelete).not.toContain('resource-20260912-000000.json.bak')
  })

  it('时间戳无法解析的备份最先被删除', () => {
    const toDelete = pruneBackupNames(
      ['broken.json.bak', 'resource-20260901-000000.json.bak'],
      1
    )
    expect(toDelete).toEqual(['broken.json.bak'])
  })

  it('数量不足 keep 时一个都不删', () => {
    expect(pruneBackupNames(['resource-20260901-000000.json.bak'], 10)).toEqual([])
    expect(pruneBackupNames([], 10)).toEqual([])
  })
})
