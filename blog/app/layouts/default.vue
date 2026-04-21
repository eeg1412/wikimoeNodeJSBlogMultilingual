<template>
  <div class="pb-20 pt-8">
    <div class="container-shell space-y-8">
      <header class="glass-panel p-6 sm:p-8">
        <div class="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <NuxtLink :to="homePath" class="font-display text-3xl text-stone-900 dark:text-white">
              {{ options.siteTitle || 'Wikimoe Multilingual' }}
            </NuxtLink>
            <p class="mt-2 max-w-2xl text-sm leading-7 text-stone-600 dark:text-stone-300">
              {{ options.siteSubTitle || 'Independent multilingual companion site' }}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <NuxtLink :to="`/${languageCode}/post/list`" class="rounded-full border border-stone-200/70 px-4 py-2 text-sm font-medium hover:border-accent-400 hover:text-accent-700 dark:border-white/10">
              全部文章
            </NuxtLink>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <slot />

      <footer class="glass-panel p-6 text-sm text-stone-500 dark:text-stone-400">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span>{{ options.siteFooterInfo || 'Powered by Wikimoe Multilingual' }}</span>
          <span v-if="options.siteShowBlogVersion">v{{ runtimeConfig.public.version || '0.1.0' }}</span>
        </div>
      </footer>
    </div>
  </div>
</template>

<script setup>
import ThemeToggle from '@/components/ThemeToggle.vue'
import { useSiteOptions } from '@/composables/useSiteOptions'

const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const languageCode = computed(() => String(route.params.lang || 'en'))
const homePath = computed(() => `/${languageCode.value}`)
const { options } = await useSiteOptions(languageCode)

useHead(() => ({
  htmlAttrs: {
    lang: languageCode.value
  },
  link: options.value.siteFavicon
    ? [{ rel: 'icon', href: options.value.siteFavicon }]
    : [],
  meta: [
    {
      name: 'description',
      content: options.value.siteDescription || 'Independent multilingual companion site'
    },
    {
      name: 'keywords',
      content: options.value.siteKeywords || ''
    }
  ],
  script: options.value.siteExtraJs
    ? [{ innerHTML: String(options.value.siteExtraJs), tagPosition: 'bodyClose' }]
    : [],
  style: options.value.siteExtraCss
    ? [{ innerHTML: String(options.value.siteExtraCss) }]
    : [],
  titleTemplate: title => {
    if (!title) {
      return options.value.siteTitle || 'Wikimoe Multilingual'
    }
    return `${title} | ${options.value.siteTitle || 'Wikimoe Multilingual'}`
  }
}))
</script>