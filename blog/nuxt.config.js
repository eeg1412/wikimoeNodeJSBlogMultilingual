export default defineNuxtConfig({
  app: {
    head: {
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1.0'
    }
  },
  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/color-mode', '@nuxt/icon'],
  css: ['~/assets/css/main.css', 'photoswipe/style.css'],
  devtools: {
    enabled: true
  },
  devServer: {
    port: 3101
  },
  runtimeConfig: {
    apiDomain: process.env.NUXT_API_DOMAIN || 'http://127.0.0.1:3100',
    public: {
      apiDomain: process.env.NUXT_API_DOMAIN || 'http://127.0.0.1:3100',
      sourceBlogPublicOrigin:
        process.env.NUXT_PUBLIC_SOURCE_BLOG_PUBLIC_ORIGIN ||
        'http://127.0.0.1:3000',
      localizedPublicBasePath:
        process.env.NUXT_PUBLIC_LOCALIZED_PUBLIC_BASE_PATH || '/localized',
      siteOrigin:
        process.env.NUXT_PUBLIC_SITE_ORIGIN || 'http://127.0.0.1:3101',
      version: process.env.npm_package_version
    }
  },
  colorMode: {
    preference: 'system',
    fallback: 'light',
    hid: 'nuxt-color-mode-script'
  },
  nitro: {
    output: {
      dir: 'build/.output',
      serverDir: 'build/.output/server',
      publicDir: 'build/.output/public'
    }
  },
  compatibilityDate: '2026-04-21'
})
