import { sanitizeFilename } from '../src/shared/filename'
import { pickAvailablePath } from '../src/main/downloads/unique'
import { join } from 'path'

describe('下载文件名清洗（PRD 4.3）', () => {
  it('替换 Windows 非法字符', () => {
    expect(sanitizeFilename('a<b>c:d"e/f\\g|h?i*j')).toBe('a_b_c_d_e_f_g_h_i_j')
    expect(sanitizeFilename('名字\x00\x1f.png')).toBe('名字__.png')
  })

  it('去除首尾空白与点', () => {
    expect(sanitizeFilename('  .file.zip. . ')).toBe('file.zip')
  })

  it('空名回退 download；Windows 保留名加前缀', () => {
    expect(sanitizeFilename('<<<>>>')).toBe('download')
    expect(sanitizeFilename('CON')).toBe('_CON')
    expect(sanitizeFilename('com1.txt')).toBe('_com1.txt')
    expect(sanitizeFilename('正常文件.txt')).toBe('正常文件.txt')
  })
})

describe('下载路径去重', () => {
  const dir = 'D:\\Downloads'

  it('无冲突直接返回', () => {
    const p = pickAvailablePath(() => false, dir, 'file.zip')
    expect(p).toBe(join(dir, 'file.zip'))
  })

  it('冲突时追加 (n) 序号并保留扩展名', () => {
    const taken = new Set([join(dir, 'file.zip'), join(dir, 'file(1).zip')])
    const p = pickAvailablePath((x) => taken.has(x), dir, 'file.zip')
    expect(p).toBe(join(dir, 'file(2).zip'))
  })

  it('无扩展名文件也可去重', () => {
    const taken = new Set([join(dir, 'README'), join(dir, 'README(1)')])
    expect(pickAvailablePath((x) => taken.has(x), dir, 'README')).toBe(join(dir, 'README(2)'))
  })

  it('点文件整体作词干', () => {
    const taken = new Set([join(dir, '.bashrc')])
    expect(pickAvailablePath((x) => taken.has(x), dir, '.bashrc')).toBe(join(dir, '.bashrc(1)'))
  })
})
