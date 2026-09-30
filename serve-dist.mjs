import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.join(__dirname, 'dist')
const PORT = 4173
const HOST = '0.0.0.0'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    return res.end()
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  let reqPath = decodeURIComponent(parsedUrl.pathname)
  if (reqPath.endsWith('/')) reqPath += 'index.html'

  let filePath = path.join(DIST_DIR, reqPath)

  // SPA fallback: if file does not exist, serve index.html
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html')
  }

  try {
    const ext = path.extname(filePath).toLowerCase()
    const contentType = MIME[ext] || 'application/octet-stream'
    const stat = fs.statSync(filePath)

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Cache-Control': ext === '.html' || ext === '.webmanifest' || filePath.endsWith('sw.js')
        ? 'no-cache'
        : 'public, max-age=31536000, immutable',
    })

    fs.createReadStream(filePath).pipe(res)
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('Server error: ' + err.message)
  }
})

server.listen(PORT, HOST, () => {
  console.log(`[MyDuit PWA] Live on http://${HOST}:${PORT}`)
  console.log(`[MyDuit PWA] Serving from: ${DIST_DIR}`)
})
