import { fileURLToPath } from 'node:url'
import path from 'node:path'
import express from 'express'
import compression from 'compression'
import { createProxyMiddleware } from 'http-proxy-middleware'
import proxies from './proxies.json' with { type: 'json' }

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const app = express()
app.set('env', 'production')
app.disable('x-powered-by')

for (const route of proxies) {
  app.use(createProxyMiddleware({
    pathFilter: pathname => pathname === route.prefix || pathname.startsWith(route.prefix + '/'),
    pathRewrite: url => route.upstream + url.slice(route.prefix.length),
    target: process.env[route.env] || route.default,
    changeOrigin: true,
  }))
}

app.use('/api', (_req, res) => res.sendStatus(404))
app.use(compression())
app.use('/assets', express.static(path.join(root, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }))
app.use(express.static(root, { index: false }))
app.get('/{*path}', (req, res) => {
  if (!req.accepts('html') || path.extname(req.path)) return res.sendStatus(404)
  res.set('Cache-Control', 'no-cache').sendFile(path.join(root, 'index.html'))
})
app.listen(Number(process.env.ADMIN_UI_PORT || 5178), process.env.ADMIN_UI_HOST || '0.0.0.0')
