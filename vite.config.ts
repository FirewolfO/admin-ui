import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const permissionTarget = env.VITE_PERMISSION_PROXY_TARGET || 'http://127.0.0.1:8081'
  const gatewayTarget = env.VITE_GATEWAY_ADMIN_PROXY_TARGET || 'http://127.0.0.1:8083'
  const blogTarget = env.VITE_BLOG_PROXY_TARGET || 'http://127.0.0.1:8086'
  const aiWorkbenchTarget = env.VITE_AI_WORKBENCH_PROXY_TARGET || 'http://127.0.0.1:8087'
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
      proxy: {
        '/api/permission': {
          target: permissionTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/permission/, '/api'),
        },
        '/api/gateway-admin': {
          target: gatewayTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/gateway-admin/, '/api'),
        },
        '/api/blog': {
          target: blogTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/blog/, '/api'),
        },
        '/api/ai-workbench': {
          target: aiWorkbenchTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ai-workbench/, '/api'),
        },
        '/media': {
          target: blogTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
