import { buildCategoryTree, filterResources, sortResources, SORT_MODES, normalizeSort } from '../src/renderer/src/utils/library'
import type { Resource } from '../src/shared/types'

function res(id: number, name: string, category: string, introduction = ''): Resource {
  return { id, name, category, introduction, links: [`https://x/${id}`] }
}

const list: Resource[] = [
  res(1, '视频剪辑工具', '自研', '一款剪辑软件'),
  res(2, '壁纸合集', '素材', '高清壁纸'),
  res(3, '字体包', '素材', '中文字体'),
  res(4, '源码生成器', '自研', '开源代码 Code 工具')
]

describe('分类树（PRD 4.1 左侧分类树）', () => {
  it('「全部」置顶且计数为总数，分类按拼音序排列', () => {
    const tree = buildCategoryTree(list)
    expect(tree).toEqual([
      { name: '全部', count: 4 },
      { name: '素材', count: 2 },
      { name: '自研', count: 2 }
    ])
  })

  it('空数据只有「全部」节点且计数 0', () => {
    expect(buildCategoryTree([])).toEqual([{ name: '全部', count: 0 }])
  })

  it('缺省分类的资源计入未分类', () => {
    const tree = buildCategoryTree([
      { id: 9, name: 'x', category: '未分类', introduction: '', links: [] }
    ])
    expect(tree).toContainEqual({ name: '未分类', count: 1 })
  })
})

describe('资源过滤（分类 + 实时搜索）', () => {
  it('按分类筛选', () => {
    const out = filterResources(list, '自研', '')
    expect(out.map((r) => r.id)).toEqual([1, 4])
  })

  it('关键词匹配名称或简介，不区分大小写', () => {
    expect(filterResources(list, '全部', '工具').map((r) => r.id)).toEqual([1, 4])
    expect(filterResources(list, '全部', '壁纸').map((r) => r.id)).toEqual([2])
    expect(filterResources(list, '全部', 'CODE').map((r) => r.id)).toEqual([4])
  })

  it('分类与关键词叠加过滤', () => {
    expect(filterResources(list, '素材', '字体').map((r) => r.id)).toEqual([3])
    expect(filterResources(list, '自研', '壁纸')).toEqual([])
  })

  it('空白关键词等价于不过滤', () => {
    expect(filterResources(list, '全部', '   ')).toHaveLength(4)
  })

  it('无匹配返回空数组', () => {
    expect(filterResources(list, '全部', '不存在的关键词')).toEqual([])
  })
})


describe('资源排序（v2.0.0：时间新旧 / 字母 AZ）', () => {
  const items: Resource[] = [
    { id: 1, name: '香蕉', category: 'A', introduction: '', links: ['https://x/1'], release_date: '2026.03.01' },
    { id: 2, name: '苹果', category: 'A', introduction: '', links: ['https://x/2'], last_modified: '2026-05-10' },
    { id: 3, name: '橙子', category: 'A', introduction: '', links: ['https://x/3'], release_date: '2025.12.20' },
    { id: 4, name: '无日期', category: 'A', introduction: '', links: ['https://x/4'] }
  ]

  it('SORT_MODES 恰好四种且默认由新至旧', () => {
    expect(SORT_MODES.map((m) => m.value)).toEqual(['time-desc', 'time-asc', 'alpha-asc', 'alpha-desc'])
    expect(SORT_MODES.map((m) => m.label)).toEqual([
      '时间（由新至旧）',
      '时间（由旧至新）',
      '字母（A-Z）',
      '字母（Z-A）'
    ])
    expect(normalizeSort(undefined)).toBe('time-desc')
    expect(normalizeSort('bogus')).toBe('time-desc')
  })

  it('时间由新至旧：last_modified 优先于 release_date，无日期排最后', () => {
    expect(sortResources(items, 'time-desc').map((r) => r.id)).toEqual([2, 1, 3, 4])
  })

  it('时间由旧至新：无日期排最前', () => {
    expect(sortResources(items, 'time-asc').map((r) => r.id)).toEqual([4, 3, 1, 2])
  })

  it('字母 A-Z / Z-A（中文按拼音）', () => {
    expect(sortResources(items, 'alpha-asc').map((r) => r.id)).toEqual([3, 2, 4, 1])
    expect(sortResources(items, 'alpha-desc').map((r) => r.id)).toEqual([1, 4, 2, 3])
  })

  it('排序返回新数组且不修改入参', () => {
    const before = items.map((r) => r.id)
    sortResources(items, 'alpha-asc')
    expect(items.map((r) => r.id)).toEqual(before)
  })
})
