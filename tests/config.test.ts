import { normalizeConfig } from '../src/shared/config'

describe('配置归一化（PRD 4.4 下载路径/Android 浏览器选项）', () => {
  const defDir = 'C:\\Users\\u\\Downloads'

  it('空/损坏配置回退默认值', () => {
    expect(normalizeConfig(null, defDir)).toEqual({ downloadDir: defDir, androidBrowser: 'builtin' })
    expect(normalizeConfig(undefined, defDir)).toEqual({ downloadDir: defDir, androidBrowser: 'builtin' })
    expect(normalizeConfig('garbage', defDir)).toEqual({ downloadDir: defDir, androidBrowser: 'builtin' })
    expect(normalizeConfig({}, defDir)).toEqual({ downloadDir: defDir, androidBrowser: 'builtin' })
  })

  it('合法值被保留', () => {
    expect(normalizeConfig({ downloadDir: 'D:\\dd', androidBrowser: 'system' }, defDir)).toEqual({
      downloadDir: 'D:\\dd',
      androidBrowser: 'system'
    })
  })

  it('非法值被纠正：空路径回退、浏览器枚举外回退 builtin', () => {
    expect(normalizeConfig({ downloadDir: '   ' }, defDir).downloadDir).toBe(defDir)
    expect(normalizeConfig({ androidBrowser: 'ie' }, defDir).androidBrowser).toBe('builtin')
  })
})
