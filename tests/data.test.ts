import {
  DataFileError,
  parseJson,
  parseLooseJson,
  validateAnnouncement,
  validateAuthorWords,
  validateBoxInfo,
  validateResources,
  validateVersionLogs
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

  it('box.json：app_name 缺失判无效', () => {
    const good = {
      app_name: 'Pointers-BOX',
      app_version: 'Version 2.0.0 Beta',
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

  it('boxzzyhs.json：content 必填', () => {
    expect(validateAuthorWords({ content: '这是我的第一个开源项目！' })).toEqual({
      content: '这是我的第一个开源项目！'
    })
    expect(validateAuthorWords({ content: '  ' })).toBeNull()
    expect(validateAuthorWords(null)).toBeNull()
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
