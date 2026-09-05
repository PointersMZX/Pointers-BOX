// Electron 22 无 net.fetch（25 才引入），统一用 net.request 封装（Chromium 栈、默认跟随重定向）
import { net } from 'electron'

export interface NetTextResult {
  status: number
  text: string
}

export function requestText(
  url: string,
  timeoutMs: number,
  headers?: Record<string, string>
): Promise<NetTextResult> {
  return new Promise((resolve, reject) => {
    // Electron 22 的 net.request 选项不含 headers，需逐个 setHeader
    const request = net.request(url)
    if (headers) {
      for (const [name, value] of Object.entries(headers)) {
        request.setHeader(name, value)
      }
    }
    let settled = false
    const timer = setTimeout(() => {
      request.abort()
      finish(new Error('请求超时'))
    }, timeoutMs)
    const finish = (err: Error | null, result?: NetTextResult): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (err) reject(err)
      else if (result) resolve(result)
    }
    request.on('response', (response) => {
      const chunks: Buffer[] = []
      response.on('data', (c: Buffer) => chunks.push(c))
      response.on('end', () =>
        finish(null, {
          status: response.statusCode ?? 0,
          text: Buffer.concat(chunks).toString('utf-8')
        })
      )
      response.on('error', (e: Error) => finish(e))
    })
    request.on('error', (e) => finish(e))
    request.end()
  })
}
