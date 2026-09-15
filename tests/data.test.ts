import {
  DataFileError,
  parseJson,
  parseLooseJson,
  validateAnnouncement,
  validateBoxInfo,
  validateResources,
  validateVersionLogs,
  getResourceShares
} from '../src/shared/validate'

const goodResource = {
  id: 20,
  name: '资源名称',
  introduction: '资源介绍内容',
  release_date: '2025.01.01',
  last_modified: '2025.01.15',
  category: '自研',
  links: ['https://platform.example.com/resource/xxxxxx']
}

describe('validateResources', () => {
  it('接受合法数据并保留全部字段', () => {
    const r = validateResources({ resources: [goodResource] })
    expect(r.valid).toHaveLength(1)
    expect(r.invalidCount).toBe(0)
    expect(r.valid[0]).toMatchObject({
      id: 20,
      name: '资源名称',
      category: '自研',
      release_date: '2025.01.01',
      links: ['https://platform.example.com/resource/xxxxxx']
    })
  })

  it('顶层结构错误抛 DataFileError（PRD 7.6 全局解析失败提示）', () => {
    expect(() => validateResources({})).toThrow(DataFileError)
    expect(() => validateResources({ resources: 'nope' })).toThrow(DataFileError)
    expect(() => validateResources(null)).toThrow(DataFileError)
  })

  it('坏条目被跳过并计数，好条目保留', () => {
    const r = validateResources({
      resources: [
        goodResource,
        { id: 21 }, // 缺 name/links
        { id: 22, name: '无链接', links: [] },
        { name: '无id', links: ['https://x'] },
        'not-an-object',
        { id: 23, name: '仅无效链接', links: ['', 123, 'https://ok'] }
      ]
    })
    expect(r.valid).toHaveLength(2)
    expect(r.valid[1]).toMatchObject({ id: 23, links: ['https://ok'] })
    expect(r.invalidCount).toBe(4)
    expect(r.errors).toHaveLength(4)
  })

  it('缺省字段回退默认值：category=未分类、introduction=空串', () => {
    const r = validateResources({
      resources: [{ id: 'a', name: 'x', links: ['https://l'] }]
    })
    expect(r.valid[0]).toMatchObject({ category: '未分类', introduction: '', id: 'a' })
  })
})

describe('其余校验器', () => {
  it('announcement：取 content，date 可缺省', () => {
    expect(validateAnnouncement({ announcement: { date: '2026.09.03', content: '公告' } })).toEqual({
      date: '2026.09.03',
      content: '公告'
    })
    expect(validateAnnouncement({ announcement: { content: 'x' } })).toEqual({ date: '', content: 'x' })
    expect(validateAnnouncement({ announcement: { date: 'd' } })).toBeNull()
    expect(validateAnnouncement({})).toBeNull()
  })

  it('version_logs：过滤缺 version 的条目', () => {
    expect(
      validateVersionLogs({ version_logs: [{ version: 'v2.0.0', log: 'x' }, { log: 'y' }, 42] })
    ).toEqual([{ version: 'v2.0.0', log: 'x' }])
    expect(validateVersionLogs({})).toEqual([])
  })

  it('boxbbgxrz.json（版本日志）：支持 {version_logs:[...]} 与顶层数组两种格式，过滤缺 version 的条目', () => {
    expect(
      validateVersionLogs({ version_logs: [{ version: 'v2.2.0', log: 'x' }, { log: 'y' }, 42] })
    ).toEqual([{ version: 'v2.2.0', log: 'x' }])
    // 顶层直接是数组
    expect(validateVersionLogs([{ version: 'v2.1.0', log: 'y' }])).toEqual([
      { version: 'v2.1.0', log: 'y' }
    ])
    expect(validateVersionLogs({})).toEqual([])
    expect(validateVersionLogs(null)).toEqual([])
  })

  it('box.json：app_name 缺失判无效（v2.2.0 起不再读 app_version）', () => {
    const good = {
      app_name: 'Pointers-BOX',
      app_introduction: '简介',
      general_key: 'zycx、Pointers',
      developer: 'Pointers',
      community_qq: '335753296',
      copyright: 'Copyright © 2026'
    }
    expect(validateBoxInfo(good)).toMatchObject({ app_name: 'Pointers-BOX', developer: 'Pointers' })
    expect(validateBoxInfo({ ...good, app_name: '' })).toBeNull()
    expect(validateBoxInfo('x')).toBeNull()
  })

  it('parseJson：非法 JSON 抛 DataFileError', () => {
    expect(() => parseJson('{oops')).toThrow(DataFileError)
    expect(parseJson('{"a":1}')).toEqual({ a: 1 })
  })

  it('parseLooseJson：容忍 Markdown 代码围栏包裹（box.json 实测如此）', () => {
    const wrapped =
      '### box.json\n\n```json\n{\n  "app_name": "Pointers-BOX",\n  "developer": "Pointers"\n}\n```\n\n---'
    expect(parseLooseJson(wrapped)).toEqual({ app_name: 'Pointers-BOX', developer: 'Pointers' })
    // 纯 JSON 直通
    expect(parseLooseJson('{"a":1}')).toEqual({ a: 1 })
    // 全部无效仍抛错
    expect(() => parseLooseJson('no json here')).toThrow(DataFileError)
    // 围栏内 JSON 本身损坏仍抛错
    expect(() => parseLooseJson('```json\n{oops\n```')).toThrow(DataFileError)
  })
})


describe('多分享项 shares（v2.0.0 新格式）', () => {
  it('解析 [{name,url}] 多分享项并原样保留', () => {
    const r = validateResources({
      resources: [
        {
          id: 1,
          name: '带分享项的资源',
          links: [],
          shares: [
            { name: '本体', url: 'https://x/main' },
            { name: '补丁', url: 'https://x/patch' }
          ]
        }
      ]
    })
    expect(r.invalidCount).toBe(0)
    expect(r.valid[0]!.shares).toEqual([
      { name: '本体', url: 'https://x/main' },
      { name: '补丁', url: 'https://x/patch' }
    ])
  })

  it('shares 缺 name 自动编号，纯字符串视为 url，link 字段兼容', () => {
    const r = validateResources({
      resources: [
        {
          id: 2,
          name: '混合格式',
          links: [],
          shares: ['https://x/a', { url: 'https://x/b' }, { link: 'https://x/c', name: '汉化' }]
        }
      ]
    })
    expect(r.valid[0]!.shares).toEqual([
      { name: '分享项 1', url: 'https://x/a' },
      { name: '分享项 2', url: 'https://x/b' },
      { name: '汉化', url: 'https://x/c' }
    ])
  })

  it('只有 shares 没有 links 的资源合法', () => {
    const r = validateResources({ resources: [{ id: 3, name: '仅shares', shares: [{ name: '本体', url: 'https://x' }] }] })
    expect(r.valid).toHaveLength(1)
    expect(r.valid[0]!.links).toEqual([])
  })

  it('shares 内缺 url 的项被跳过并计数', () => {
    const r = validateResources({
      resources: [
        { id: 4, name: '坏分享', links: ['https://ok'], shares: [{ name: '无链接' }, 'https://good'] }
      ]
    })
    expect(r.invalidCount).toBe(1)
    expect(r.valid[0]!.shares).toEqual([{ name: '分享项 1', url: 'https://good' }])
  })

  it('getResourceShares：优先 shares；旧格式从 links 派生自动编号', () => {
    const withShares = { id: 1, name: 'a', category: 'c', introduction: '', links: [], shares: [{ name: '本体', url: 'https://x' }] }
    expect(getResourceShares(withShares)).toEqual([{ name: '本体', url: 'https://x' }])
    const legacy = { id: 2, name: 'b', category: 'c', introduction: '', links: ['https://l1', 'https://l2'] }
    expect(getResourceShares(legacy)).toEqual([
      { name: '分享项 1', url: 'https://l1' },
      { name: '分享项 2', url: 'https://l2' }
    ])
  })
})
