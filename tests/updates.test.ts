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

  it('v2.1.0：无 assets 字段时结果不含 assets 键（旧断言兼容）', () => {
    const info = parseReleaseJson('{"tag_name":"v3.0.0","html_url":"u","body":"b"}')
    expect('assets' in (info ?? {})).toBe(false)
  })
})

describe('Gitee Release 解析（v2.1.0 双渠道，assets 附件直链）', () => {
  it('解析 gitee assets：browser_download_url + name（+ 可选 size）', () => {
    const info = parseReleaseJson(
      JSON.stringify({
        tag_name: 'v2.1.0',
        body: '日志',
        assets: [
          {
            name: 'Pointers-BOX_Setup_v2.1.0_Windows7 x64.exe',
            browser_download_url: 'https://gitee.com/PointersMZX/Pointers-BOX/releases/download/v2.1.0/win7.exe'
          },
          {
            name: 'Pointers-BOX_Setup_V2.1.0 x64.exe',
            browser_download_url: 'https://gitee.com/PointersMZX/Pointers-BOX/releases/download/v2.1.0/win10.exe',
            size: 12345
          },
          // 坏条目（缺 url/name）被跳过
          { name: 'no-url' },
          null
        ]
      })
    )
    expect(info?.tagName).toBe('v2.1.0')
    expect(info?.assets).toHaveLength(2)
    expect(info?.assets?.[1]).toEqual({
      name: 'Pointers-BOX_Setup_V2.1.0 x64.exe',
      url: 'https://gitee.com/PointersMZX/Pointers-BOX/releases/download/v2.1.0/win10.exe',
      size: 12345
    })
  })

  it('assets 为空数组/非数组时结果不含 assets 键', () => {
    expect('assets' in (parseReleaseJson('{"tag_name":"v1","assets":[]}') ?? {})).toBe(false)
    expect('assets' in (parseReleaseJson('{"tag_name":"v1","assets":"x"}') ?? {})).toBe(false)
  })
})
