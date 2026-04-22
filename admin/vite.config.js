import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  base: '/multilingual-admin/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 3009,
    proxy: {
      '/api': {
        target: 'http://localhost:3008',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: '../server/front/admin',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'element-plus': ['element-plus'],
          wangeditor: ['@wangeditor/editor', '@wangeditor/editor-for-vue']
        }
      }
    }
  }
})
