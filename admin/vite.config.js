import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { readFileSync } from 'fs'

const pkg = JSON.parse(
  readFileSync(resolve(__dirname, 'package.json'), 'utf-8')
)

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    base: isProduction ? '/multilingual-admin/' : '/',
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version)
    },
    server: {
      port: 8079,
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3100',
          changeOrigin: true
        },
        '/localized': {
          target: 'http://127.0.0.1:3100',
          changeOrigin: true
        }
      }
    },
    build: {
      outDir: '../server/front/multilingual-admin',
      emptyOutDir: true,
      sourcemap: !isProduction,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true
        }
      }
    },
    css: {
      preprocessorOptions: {
        less: {}
      }
    }
  }
})