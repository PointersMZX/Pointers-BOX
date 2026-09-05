import { buildCategoryTree, filterResources } from '../src/renderer/src/utils/library'
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
