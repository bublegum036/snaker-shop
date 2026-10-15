import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import type { ProxyOptions } from 'vite'
import vue from '@vitejs/plugin-vue'

const apiProxy: Record<string, ProxyOptions> = {
  '/api': {
    target: process.env.SNEAKER_API_TARGET ?? 'http://127.0.0.1:8000',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ''),
  },
}

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '127.0.0.1',
    port: 4200,
    strictPort: true,
    proxy: apiProxy,
  },
  preview: {
    host: '127.0.0.1',
    port: 4300,
    strictPort: true,
    proxy: apiProxy,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
