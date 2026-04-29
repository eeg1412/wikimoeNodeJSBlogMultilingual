import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// https://nuxt.com/docs/api/configuration/nuxt-config
const __dirname = dirname(fileURLToPath(import.meta.url))
const MULTILINGUAL_LOCAL_PUBLIC_ASSET_BASE = '/_multilingual_public'
const MULTILINGUAL_LOCAL_PUBLIC_ASSET_DIR = resolve(__dirname, 'public')
const LOCAL_ENV = readLocalEnv()

function readLocalEnv() {
  const envPath = resolve(__dirname, '.env')

  if (!existsSync(envPath)) {
    return {}
  }

  return readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .reduce((envMap, line) => {
      const trimmedLine = line.trim()

      if (!trimmedLine || trimmedLine.startsWith('#')) {
        return envMap
      }

      const separatorIndex = trimmedLine.indexOf('=')

      if (separatorIndex <= 0) {
        return envMap
      }

      const key = trimmedLine.slice(0, separatorIndex).trim()
      const value = trimmedLine.slice(separatorIndex + 1).trim()
      envMap[key] = value.replace(/^['"]|['"]$/g, '')
      return envMap
    }, {})
}

function getEnvValue(key) {
  return process.env[key] || LOCAL_ENV[key] || ''
}

function withMultilingualLocalPublicAssetBase(path) {
  return `${MULTILINGUAL_LOCAL_PUBLIC_ASSET_BASE}${path}`
}

let routeRules = {
  [withMultilingualLocalPublicAssetBase('/geojson/world-mid.json')]: {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  },
  [withMultilingualLocalPublicAssetBase('/geojson/world-low.json')]: {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  },
  // 整个 avatar 目录
  [withMultilingualLocalPublicAssetBase('/img/avatar/**')]: {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  },
  // 整个 icon 目录
  [withMultilingualLocalPublicAssetBase('/img/icon/**')]: {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  },
  // 单个文件
  [withMultilingualLocalPublicAssetBase('/img/bg_02_dark.png')]: {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  },
  [withMultilingualLocalPublicAssetBase('/img/bg_02.png')]: {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  },
  [withMultilingualLocalPublicAssetBase('/img/menuBg.png')]: {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  },
  [withMultilingualLocalPublicAssetBase('/img/mypage-banner.webp')]: {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  },
  [withMultilingualLocalPublicAssetBase('/img/nodata.webp')]: {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  },
  [withMultilingualLocalPublicAssetBase('/img/nopic400-565.png')]: {
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  }
}
export default defineNuxtConfig({
  app: {
    buildAssetsDir: '/_multilingual_nuxt/',
    head: {
      charset: 'utf-8',
      viewport:
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0'
      // link: [
      //   {
      //     rel: 'icon',
      //     href: withMultilingualLocalPublicAssetBase('/favicon.ico')
      //   }
      // ]
    }
    // 因为nuxt的页面动画有BUG导致两次运行onmounted，所以关闭
    // pageTransition: { name: 'page', mode: 'out-in' },
  },

  dir: {
    public: 'public-root'
  },

  devtools: { enabled: true },

  devServer: {
    // host: '0.0.0.0',
    port: 8088
  },

  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxtjs/color-mode',
    'nuxt-swiper',
    '@nuxt/icon'
  ],

  icon: {
    localApiEndpoint: '/api/multilingual-icon'
  },

  swiper: {
    // Swiper options
    //----------------------
    // prefix: 'Swiper',
    styleLang: 'css'
    // modules: ['navigation', 'pagination'], // all modules are imported by default
  },

  css: ['~/assets/css/common.css', 'photoswipe/style.css'],

  runtimeConfig: {
    apiDomain: '',
    sourceApiDomain: '',
    sourceAssetDomain: '',
    swrEnabled: '',
    swrCacheMaxage: '',
    swrCacheStaleMaxage: '',
    swrCacheMaxPage: '',
    swrCacheTtl: '',
    public: {
      apiDomain: '',
      version: ''
    }
  },

  routeRules,

  colorMode: {
    preference: 'system',
    fallback: 'light',
    hid: 'nuxt-color-mode-script'
  },

  nitro: {
    publicAssets: [
      {
        dir: MULTILINGUAL_LOCAL_PUBLIC_ASSET_DIR,
        baseURL: MULTILINGUAL_LOCAL_PUBLIC_ASSET_BASE,
        maxAge: 31536000
      }
    ],
    output: {
      dir: 'build/.output',
      serverDir: 'build/.output/server',
      publicDir: 'build/.output/public'
    }
  },
  vite: {
    esbuild: {
      drop: ['debugger'],
      pure: [
        'console.log',
        'console.error',
        'console.warn',
        'console.debug',
        'console.trace'
      ]
    }
  },

  experimental: {
    emitRouteChunkError: 'manual'
  },

  compatibilityDate: '2026-02-10'
})
