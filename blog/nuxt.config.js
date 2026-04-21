// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/color-mode', '@nuxt/icon'],
  devServer: {
    port: Number(process.env.NUXT_PORT || process.env.NITRO_PORT || 3101)
  },
  runtimeConfig: {
    public: {
      apiDomain: process.env.NUXT_API_DOMAIN || 'http://127.0.0.1:3100',
      sourceBlogPublicOrigin:
        process.env.NUXT_PUBLIC_SOURCE_BLOG_PUBLIC_ORIGIN || '',
      localizedPublicBasePath:
        process.env.NUXT_PUBLIC_LOCALIZED_PUBLIC_BASE_PATH || '/localized',
      siteOrigin: process.env.NUXT_PUBLIC_SITE_ORIGIN || ''
    }
  },
  colorMode: {
    classSuffix: ''
  },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      meta: [
        { name: 'viewport', content: 'width=device-width,initial-scale=1' }
      ]
    }
  }
})
