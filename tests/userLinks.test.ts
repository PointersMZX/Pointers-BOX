import {
  mergeUserLinks,
  normalizeUserLink,
  sanitizeUserLinks,
  USER_LINKS_MAX
} from '../src/shared/userLinks'

const NOW = 1_700_000_000_000

const good = {
  name: '某网盘下载',
  url: 'https://pan.example.com/s/abc',
  remark: '提取码 ab12'
}

describe('用户链接规范化（v2.2.0）', () => {
  it('合法条目通过，字段修剪与默认值正确', () => {
    const link = normalizeUserLink(
      { ...good, name: '  某网盘下载  ', url: ' https://pan.example.com/s/abc ', remark: ' 备注 ', id: 'ul-1', createdAt: NOW },
      0
    )
    expect(link).toEqual({
      id: 'ul-1',
      name: '某网盘下载',
      url: 'https://pan.example.com/s/abc',
      remark: '备注',
      createdAt: NOW
    })
  })

  it('名称/链接缺失或非法时返回 null', () => {
    expect(normalizeUserLink({ ...good, name: '   ' }, 0)).toBeNull()
    expect(normalizeUserLink({ ...good, url: 'ftp://x' }, 0)).toBeNull()
    expect(normalizeUserLink({ ...good, url: 'javascript:alert(1)' }, 0)).toBeNull()
    expect(normalizeUserLink({ ...good, url: '' }, 0)).toBeNull()
    expect(normalizeUserLink(null, 0)).toBeNull()
    expect(normalizeUserLink('bad', 0)).toBeNull()
  })

  it('超长字段拒绝/截断', () => {
    expect(normalizeUserLink({ ...good, name: '名'.repeat(101) }, 0)).toBeNull()
    expect(normalizeUserLink({ ...good, url: 'https://x.com/' + 'a'.repeat(2100) }, 0)).toBeNull()
    const link = normalizeUserLink({ ...good, remark: '评'.repeat(600) }, 0)
    expect(link?.remark).toHaveLength(500)
  })

  it('id 缺失时自动生成', () => {
    const link = normalizeUserLink(good, 3)
    expect(link?.id).toMatch(/^ul-\d+-3$/)
  })
})

describe('用户链接清洗（v2.2.0）', () => {
  it('非数组回空、坏条目跳过、按 url 去重', () => {
    expect(sanitizeUserLinks('bad')).toEqual([])
    const links = sanitizeUserLinks([
      good,
      { name: '重复', url: 'HTTPS://PAN.EXAMPLE.COM/s/abc' },
      { name: '无链接' },
      null,
      { ...good, name: '另一条', url: 'http://a.example.com' }
    ])
    expect(links).toHaveLength(2)
    expect(links[0]!.name).toBe('某网盘下载')
    expect(links[1]!.url).toBe('http://a.example.com')
  })

  it('截断到上限 500 条', () => {
    const many = Array.from({ length: USER_LINKS_MAX + 10 }, (_, i) => ({
      name: `链接${i}`,
      url: `https://example.com/${i}`
    }))
    expect(sanitizeUserLinks(many)).toHaveLength(USER_LINKS_MAX)
  })
})

describe('用户链接合并导入（v2.2.0）', () => {
  it('按 url 去重合并，统计新增/跳过', () => {
    const existing = [normalizeUserLink({ ...good, id: 'a' }, 0)!]
    const incoming = [
      normalizeUserLink({ ...good, url: 'https://pan.example.com/s/ABC', name: '大小写重复' }, 0)!,
      normalizeUserLink({ name: '新链接', url: 'http://new.example.com' }, 1)!
    ]
    const { merged, added, skipped } = mergeUserLinks(existing, incoming)
    expect(added).toBe(1)
    expect(skipped).toBe(1)
    expect(merged).toHaveLength(2)
    expect(merged[0]!.name).toBe('某网盘下载') // 已有条目不被导入覆盖
  })

  it('空导入不改变既有数据', () => {
    const existing = [normalizeUserLink({ ...good, id: 'a' }, 0)!]
    const { merged, added, skipped } = mergeUserLinks(existing, [])
    expect(merged).toEqual(existing)
    expect(added).toBe(0)
    expect(skipped).toBe(0)
  })
})
