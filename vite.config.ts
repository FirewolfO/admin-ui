import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import proxies from './deploy/proxies.json'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@permission': fileURLToPath(new URL('./src/modules/permission', import.meta.url)),
        '@gateway': fileURLToPath(new URL('./src/modules/gateway', import.meta.url)),
        '@blog': fileURLToPath(new URL('./src/modules/blog', import.meta.url)),
        '@workbench': fileURLToPath(new URL('./src/modules/ai-workbench', import.meta.url)),
      },
    },
    server: {
      port: 5178,
      proxy: Object.fromEntries(proxies.map(route => [route.prefix, {
        target: env[route.env] || route.default,
        changeOrigin: true,
        rewrite: (path: string) => route.upstream + path.slice(route.prefix.length),
      }])),
    },
  }
})
