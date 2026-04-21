import { defineStore } from 'pinia'
import http from '@/api/http'

export const useSiteStore = defineStore('site', {
  state: () => ({
    loaded: false,
    options: {},
    sourceBlogPublicOrigin: '',
    localizedPublicBasePath: '/localized',
    supportedLanguageCodes: ['en', 'jp', 'tw']
  }),
  actions: {
    async load() {
      if (this.loaded) return
      try {
        const resp = await http.get('/site/info').catch(() => null)
        if (resp && resp.data) {
          this.applyInfo(resp.data)
        }
      } catch (_) {}
      // 兜底
      this.loaded = true
    },
    applyInfo(info) {
      this.options = info.options || {}
      if (info.sourceBlogPublicOrigin) {
        this.sourceBlogPublicOrigin = info.sourceBlogPublicOrigin
      }
      if (info.localizedPublicBasePath) {
        this.localizedPublicBasePath = info.localizedPublicBasePath
      }
      if (info.supportedLanguageCodes) {
        this.supportedLanguageCodes = info.supportedLanguageCodes
      }
    }
  }
})
