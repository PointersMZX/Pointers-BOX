import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  decryptMuxed,
  encryptMuxed,
  isMuxed,
  openMuxed
} from '../src/shared/mcx'
import { REMOTE_URLS } from '../src/shared/types'

// 确定性盐源：输出归一到 [0,1)（与 Math.random 同契约，randomSalt 按 [0,1)*256 取盐）
function fixedRng(seed = 42): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000
  }
}

describe('v2.4.0 MCX 数据文件（品牌自有加密容器）', () => {
  it('加密→解密往返一致（含中文/换行/特殊字符）', () => {
    const plain = '{"app_name":"Pointers-BOX","note":"中文\n换行\t制表\\"引号"}'
    expect(decryptMuxed(encryptMuxed(plain, fixedRng(1)))).toBe(plain)
  })

  it('同明文两次加密产物不同（随机盐）且都能解开', () => {
    const plain = '{"a":1}'
    const a = encryptMuxed(plain, fixedRng(7))
    const b = encryptMuxed(plain, fixedRng(8))
    expect(a).not.toBe(b)
    expect(decryptMuxed(a)).toBe(plain)
    expect(decryptMuxed(b)).toBe(plain)
  })

  it('密文不含明文片段（非明文 JSON、不可读 base64）', () => {
    const out = encryptMuxed('{"app_name":"Pointers-BOX","general_key":"zycx"}', fixedRng(3))
    expect(out).not.toContain('app_name')
    expect(out).not.toContain('zycx')
    expect(out).not.toMatch(/^\s*\{/)
  })

  it('篡改任一字符后解密失败（不返回原明文）', () => {
    const out = encryptMuxed('{"a":1}', fixedRng(5))
    // 首位换 'A'（仍是合法 base64），解密结果应不再等于原明文或直接失败
    const tampered = 'A' + out.slice(1)
    expect(decryptMuxed(tampered) === '{"a":1}').toBe(false)
  })

  it('非 mcx 内容（明文 JSON/垃圾文本）解密返回 null，openMuxed 原样放行', () => {
    expect(decryptMuxed('{"plain":"json"}')).toBeNull()
    expect(decryptMuxed('garbage!!')).toBeNull()
    const plain = '{"plain":true}'
    expect(openMuxed(plain)).toBe(plain)
  })

  it('isMuxed 只认 mcx', () => {
    expect(isMuxed(encryptMuxed('{}', fixedRng(9)))).toBe(true)
    expect(isMuxed('{}')).toBe(false)
  })

  it('base64 中夹杂换行/空白仍可解（FTP 上传换行容错）', () => {
    const enc = encryptMuxed('{"a":2}', fixedRng(11))
    const withNewlines = enc.slice(0, 20) + '\r\n' + enc.slice(20)
    expect(decryptMuxed(withNewlines)).toBe('{"a":2}')
  })

  it('构建产物 resources/box.mcx 解密 === resources/box.json（构建链一致性）', () => {
    const json = readFileSync(join(__dirname, '..', 'resources', 'box.json'), 'utf-8')
    const mcx = readFileSync(join(__dirname, '..', 'resources', 'box.mcx'), 'utf-8')
    expect(decryptMuxed(mcx)).toBe(json)
  })

  it('REMOTE_URLS 已切换为 .mcx（数据 3 件 + 分享页迁 api 子域；box 嵌入兜底保持旧域）', () => {
    expect(REMOTE_URLS.resources).toBe('https://api.pointers-box.cc.cd/box/resources.mcx')
    expect(REMOTE_URLS.announcement).toBe('https://api.pointers-box.cc.cd/box/announcement.mcx')
    expect(REMOTE_URLS.box).toBe('https://pointers-box.cc.cd/box/box.mcx')
    expect(REMOTE_URLS.versionLogs).toBe('https://api.pointers-box.cc.cd/box/boxbbgxrz.mcx')
  })
})
