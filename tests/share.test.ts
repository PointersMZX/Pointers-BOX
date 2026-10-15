import {
  SHARE_PAGE_URL,
  buildShareText,
  resourceShareUrl,
  shareIntroLine
} from '../src/shared/share'
import type { Resource } from '../src/shared/types'

const res: Resource = {
  id: 7,
  name: '某资源',
  introduction: '这是一个资源简介',
  category: '软件',
  links: ['https://example.com/a'],
  shares: [{ name: '官方下载', url: 'https://example.com/a' }]
}

describe('平台绑定分享（v2.4.0：分享文本只带平台分享页链接，不带资源链接本身）', () => {
  it('分享链接 = 平台分享页 + 资源 id', () => {
    expect(resourceShareUrl(res)).toBe('https://pointers-box.cc.cd/box/share.html?id=7')
  })

  it('字符串 id 原样编码，特殊字符不逃逸查询参数', () => {
    expect(resourceShareUrl({ id: '9#x y' })).toBe(`${SHARE_PAGE_URL}?id=9%23x%20y`)
  })

  it('分享文本结构：标题/名称/简介/引导语/链接（顺序固定）', () => {
    expect(buildShareText(res)).toBe(
      [
        '【Pointers资源分享平台】',
        '资源名称：某资源',
        '这是一个资源简介',
        '点击下方链接在平台上领取：',
        'https://pointers-box.cc.cd/box/share.html?id=7'
      ].join('\n')
    )
  })

  it('分享文本中绝不出现资源真实链接（本条功能的核心约束）', () => {
    const text = buildShareText(res)
    expect(text).not.toContain('https://example.com')
    expect(text).toContain(SHARE_PAGE_URL)
  })

  it('简介为空时省略该行（不多余空行）', () => {
    const text = buildShareText({ ...res, introduction: '   \n ' })
    expect(text.split('\n').length).toBe(4)
    expect(text).not.toContain('\n\n')
  })

  it('简介取第一个非空行', () => {
    expect(shareIntroLine('第一行\n第二行')).toBe('第一行')
    expect(shareIntroLine('\n\n第三行\n')).toBe('第三行')
  })

  it('简介超 40 字截断加省略号，恰 40 字不截', () => {
    expect(shareIntroLine('x'.repeat(41))).toBe(`${'x'.repeat(40)}…`)
    expect(shareIntroLine('x'.repeat(40))).toBe('x'.repeat(40))
    expect(shareIntroLine(undefined)).toBe('')
  })
})
