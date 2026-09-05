import { normalizeConfig } from '../src/shared/config'

describe('配置归一化（PRD 4.4 下载路径/Android 浏览器选项 + 主题外观）', () => {
  const defDir = 'C:\\Users\\u\\Downloads'
  const defaults = {
    downloadDir: defDir,
    androidBrowser: 'builtin' as const,
    theme: 'glass' as const,
    accent: '#3182ce'
  }

  it('空/损坏配置回退默认值（默认液态玻璃主题）', () => {
    expect(normalizeConfig(null, defDir)).toEqual(defaults)
    expect(normalizeConfig(undefined, defDir)).toEqual(defaults)
    expect(normalizeConfig('garbage', defDir)).toEqual(defaults)
    expect(normalizeConfig({}, defDir)).toEqual(defaults)
  })

  it('合法值被保留', () => {
    expect(
      normalizeConfig(
        { downloadDir: 'D:\\dd', androidBrowser: 'system', theme: 'black', accent: '#ff8800' },
        defDir
      )
    ).toEqual({
      downloadDir: 'D:\\dd',
      androidBrowser: 'system',
      theme: 'black',
      accent: '#ff8800'
    })
  })

  it('非法值被纠正：空路径回退、浏览器枚举外回退 builtin、主题/颜色非法回退默认', () => {
    expect(normalizeConfig({ downloadDir: '   ' }, defDir).downloadDir).toBe(defDir)
    expect(normalizeConfig({ androidBrowser: 'ie' }, defDir).androidBrowser).toBe('builtin')
    expect(normalizeConfig({ theme: 'neon' }, defDir).theme).toBe('glass')
    expect(normalizeConfig({ accent: 'not-a-color' }, defDir).accent).toBe('#3182ce')
  })
})
