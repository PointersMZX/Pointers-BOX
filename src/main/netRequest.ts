// Electron 22 无 net.fetch（25 才引入），统一用 net.request 封装（Chromium 栈、默认跟随重定向）
import { net } from 'electron'
import { createWriteStream } from 'fs'

export interface NetTextResult {
  status: number
  text: string
}

export interface NetFileResult {
  status: number
  path: string
  received: number
  total: number
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

// v2.1.0：二进制文件下载（Gitee 更新包直链），流式写盘 + 进度回调
export function requestFile(
  url: string,
  destPath: string,
  headers?: Record<string, string>,
  onProgress?: (received: number, total: number, bytesPerSecond: number) => void
): Promise<NetFileResult> {
  return new Promise((resolve, reject) => {
    const request = net.request(url)
    if (headers) {
      for (const [name, value] of Object.entries(headers)) {
        request.setHeader(name, value)
      }
    }
    let settled = false
    let received = 0
    let lastTickAt = Date.now()
    let lastTickBytes = 0
    let bytesPerSecond = 0
    // 进度节流：最多每 250ms 上报一次（v2.1.0 内存/IPC 优化）
    let lastReportAt = 0
    const ws = createWriteStream(destPath)
    const finish = (err: Error | null, result?: NetFileResult): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      ws.destroy()
      if (err) reject(err)
      else if (result) resolve(result)
    }
    const timer = setTimeout(() => {
      request.abort()
      finish(new Error('下载超时'))
    }, 10 * 60_000)
    request.on('response', (response) => {
      const status = response.statusCode ?? 0
      if (status < 200 || status >= 300) {
        request.abort()
        finish(new Error(`HTTP ${status}`))
        return
      }
      const total = Number(response.headers['content-length'] ?? 0)
      response.on('data', (c: Buffer) => {
        received += c.length
        ws.write(c)
        const now = Date.now()
        if (now - lastTickAt >= 1000) {
          bytesPerSecond = Math.round(((received - lastTickBytes) * 1000) / (now - lastTickAt))
          lastTickAt = now
          lastTickBytes = received
        }
        if (onProgress && (received === total || now - lastReportAt >= 250)) {
          lastReportAt = now
          onProgress(received, total, bytesPerSecond)
        }
      })
      response.on('end', () => {
        ws.end(() =>
          finish(null, { status, path: destPath, received, total })
        )
      })
      response.on('error', (e: Error) => finish(e))
    })
    request.on('error', (e) => finish(e))
    request.end()
  })
}
