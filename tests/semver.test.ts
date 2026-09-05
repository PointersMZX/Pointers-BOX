import { compareVersions, isNewerVersion, parseVersion } from '../src/shared/semver'

describe('semver 比较（更新检查用）', () => {
  it('解析版本号（含 v 前缀与预发布）', () => {
    expect(parseVersion('2.0.0')).toMatchObject({ major: 2, minor: 0, patch: 0, pre: [] })
    expect(parseVersion('v2.0.0')).toMatchObject({ major: 2, minor: 0, patch: 0, pre: [] })
    expect(parseVersion('Version 2.0.0 Beta')).toBeNull() // 仅接受标准格式
    expect(parseVersion('v2.0.0-beta.1')).toMatchObject({ major: 2, pre: ['beta', '1'] })
  })

  it('主/次/修订号比较', () => {
    expect(compareVersions('2.0.0', '1.9.9')).toBe(1)
    expect(compareVersions('2.1.0', '2.0.9')).toBe(1)
    expect(compareVersions('2.0.1', '2.0.0')).toBe(1)
    expect(compareVersions('v2.0.0', '2.0.0')).toBe(0)
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1)
  })

  it('预发布 < 正式版；预发布按 semver 规则比较', () => {
    expect(compareVersions('2.0.0-beta.1', '2.0.0')).toBe(-1)
    expect(compareVersions('2.0.0-beta.1', '2.0.0-alpha.1')).toBe(1)
    expect(compareVersions('2.0.0-beta.2', '2.0.0-beta.1')).toBe(1)
    expect(compareVersions('2.0.0-beta.11', '2.0.0-beta.2')).toBe(1) // 数值比较而非字典序
    expect(compareVersions('2.0.0-1', '2.0.0-alpha')).toBe(-1) // 数字段 < 字符串段
    expect(compareVersions('2.0.0-alpha', '2.0.0-alpha.1')).toBe(-1) // 短段 < 长段
  })

  it('isNewerVersion：候选是否比当前新', () => {
    expect(isNewerVersion('v2.1.0', '2.0.0')).toBe(true)
    expect(isNewerVersion('2.0.0', '2.0.0')).toBe(false)
    expect(isNewerVersion('v1.0.0', '2.0.0')).toBe(false)
    expect(isNewerVersion('2.0.1-beta.1', '2.0.0')).toBe(true)
  })

  it('无法解析的版本不触发更新', () => {
    expect(isNewerVersion('garbage', '1.0.0')).toBe(false)
    expect(isNewerVersion('v2.0.0', 'what')).toBe(false)
  })
})
