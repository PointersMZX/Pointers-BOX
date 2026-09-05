import { parseReleaseJson } from '../src/shared/updates'

describe('GitHub Release 解析（PRD 4.4 检查更新）', () => {
  it('解析 tag_name / html_url / body', () => {
    const info = parseReleaseJson(
      JSON.stringify({
        tag_name: 'v2.1.0',
        html_url: 'https://github.com/PointersMZX/Pointers-BOX/releases/tag/v2.1.0',
        body: '更新日志'
      })
    )
    expect(info).toEqual({
      tagName: 'v2.1.0',
      htmlUrl: 'https://github.com/PointersMZX/Pointers-BOX/releases/tag/v2.1.0',
      notes: '更新日志'
    })
  })

  it('缺 tag_name 判无效', () => {
    expect(parseReleaseJson(JSON.stringify({ html_url: 'x' }))).toBeNull()
    expect(parseReleaseJson(JSON.stringify({ tag_name: '' }))).toBeNull()
  })

  it('非对象/坏 JSON 返回 null', () => {
    expect(parseReleaseJson('not json')).toBeNull()
    expect(parseReleaseJson('[1,2]')).toBeNull()
    expect(parseReleaseJson('null')).toBeNull()
  })

  it('html_url/body 可缺省', () => {
    expect(parseReleaseJson('{"tag_name":"v3.0.0"}')).toEqual({
      tagName: 'v3.0.0',
      htmlUrl: undefined,
      notes: undefined
    })
  })
})
