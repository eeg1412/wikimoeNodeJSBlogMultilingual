<script setup>
const route = useRoute()
const site = useSiteOptions()
const currentLang = computed(() => route.params?.lang || '')
const langs = useSupportedLanguages()

const { applyAdSenseScript } = useGoogleAds()
applyAdSenseScript()

// 站点自定义 CSS / JS 注入
const extraHeadChildren = computed(() => {
  const items = []
  if (site.value?.siteExtraCss) {
    items.push({ tagName: 'style', innerHTML: site.value.siteExtraCss })
  }
  if (site.value?.siteExtraJs) {
    items.push({ tagName: 'script', innerHTML: site.value.siteExtraJs })
  }
  return items
})

useHead(() => {
  const head = {}
  if (site.value?.siteFavicon) {
    head.link = [{ rel: 'icon', href: site.value.siteFavicon }]
  }
  if (extraHeadChildren.value.length) {
    head.style = extraHeadChildren.value
      .filter(i => i.tagName === 'style')
      .map(i => ({ innerHTML: i.innerHTML }))
    head.script = (head.script || []).concat(
      extraHeadChildren.value
        .filter(i => i.tagName === 'script')
        .map(i => ({ innerHTML: i.innerHTML }))
    )
  }
  return head
})

function switchLangTarget(code) {
  // 同一页面跨语言跳转：由于 id/alias 在不同语言下不同，统一跳到该语言首页。
  return `/${code}`
}
</script>

<template>
  <div
    class="min-h-screen flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100"
  >
    <header class="site-header border-b border-gray-200 dark:border-gray-800">
      <div
        class="site-header-inner max-w-5xl mx-auto px-4 h-14 flex items-center justify-between"
      >
        <NuxtLink
          :to="currentLang ? `/${currentLang}` : '/'"
          class="site-header-title font-semibold"
        >
          {{ site?.siteTitle || 'Wikimoe Multilingual' }}
        </NuxtLink>
        <nav class="site-header-nav flex items-center gap-3 text-sm">
          <NuxtLink
            v-for="code in langs"
            :key="code"
            :to="switchLangTarget(code)"
            class="site-header-lang px-2 py-1 rounded"
            :class="
              currentLang === code
                ? 'bg-blue-500 text-white'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800'
            "
          >
            {{ code.toUpperCase() }}
          </NuxtLink>
        </nav>
      </div>
    </header>
    <main class="flex-1 max-w-5xl mx-auto px-4 py-6 w-full">
      <slot />
    </main>
    <footer
      class="site-footer border-t border-gray-200 dark:border-gray-800 py-4 text-center text-xs text-gray-500 dark:text-gray-400"
    >
      <div v-if="site?.siteFooterInfo" v-html="site.siteFooterInfo"></div>
      <div v-else>© {{ new Date().getFullYear() }}</div>
    </footer>
  </div>
</template>
