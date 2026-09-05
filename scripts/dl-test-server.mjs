// 场景测试服务器：
// /file.zip        2MB 附件（已完成验证）
// /auto-popup.html 页面加载后 window.open 打开附件（模拟平台站点新窗口下载）
// /big.zip         慢速大文件（约 30 秒，用于观察进度与切页场景）
import http from 'node:http'

const PORT = 51787
const chunk = Buffer.alloc(64 * 1024)
for (let i = 0; i < chunk.length; i++) chunk[i] = (i * 31 + 7) & 0xff
const body = Buffer.concat(Array.from({ length: 32 }, () => chunk))

const server = http.createServer((req, res) => {
  console.log(`[server] ${req.method} ${req.url}`)
  if (req.url === '/file.zip') {
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Length': body.length,
      'Content-Disposition': 'attachment; filename="pbox-e2e-test.zip"'
    })
    res.end(body)
    return
  }
  if (req.url === '/big.zip') {
    // 总量 ~48MB，每 100ms 发 160KB → 约 30 秒
    const total = 300
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Length': chunk.length * total,
      'Content-Disposition': 'attachment; filename="pbox-e2e-big.zip"'
    })
    let sent = 0
    const timer = setInterval(() => {
      if (sent >= total) {
        clearInterval(timer)
        res.end()
        console.log('[server] big.zip finished')
        return
      }
      res.write(chunk)
      sent++
    }, 100)
    res.on('close', () => {
      clearInterval(timer)
      console.log(`[server] big.zip client closed at ${sent}/${total}`)
    })
    return
  }
  if (req.url === '/auto-popup.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`<html><body><h1>popup download page</h1><script>setTimeout(()=>{window.open('/file.zip','_blank')},800)</script></body></html>`)
    return
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end('<html><body>ok</body></html>')
})

server.listen(PORT, '127.0.0.1', () =>
  console.log(`[server] ready: /file.zip /big.zip /auto-popup.html`)
)
