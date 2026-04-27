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
      },
      extensions: [
        '.mjs',
        '.js',
        '.mts',
        '.ts',
        '.jsx',
        '.tsx',
        '.json',
        '.vue'
      ]
    },
    base: isProduction ? '/multilingual-admin/' : '/',
    define: {
      'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version)
    },
    server: {
      port: 8079,
      proxy: {
        '/api/multilingual-admin': {
          target: 'http://127.0.0.1:3016',
          changeOrigin: true
        },
        '/multilingual-assets': {
          target: 'http://127.0.0.1:3016',
          changeOrigin: true
        }
      }
    },
    build: {
      outDir: '../server/front/multilingual-admin/',
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
