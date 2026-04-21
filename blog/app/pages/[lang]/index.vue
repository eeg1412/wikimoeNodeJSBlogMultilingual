<script setup>
const route = useRoute()
const lang = computed(() => route.params.lang)

if (!isSupportedLang(lang.value)) {
  throw createError({ statusCode: 404, statusMessage: 'Unsupported language' })
}

// 语言首页直接展示最新文章列表首页。
const { data: listRes } = await useAsyncData(
  () => `post-list-${lang.value}-1`,
  () => fetchPostList({ lang: lang.value, page: 1 })
)

const site = useSiteOptions().value || {}
const langs = useSupportedLanguages()
useBlogSeo({
  lang: lang.value,
  path: `/${lang.value}`,
  title: site.siteTitle,
  description: site.siteDescription,
  keywords: site.siteKeywords,
  alternates: langs.map(code => ({ languageCode: code, path: `/${code}` }))
})

function buildHref(page) {
  if (page === 1) return `/${lang.value}`
  return `/${lang.value}/post/list?page=${page}`
}
</script>

<template>
  <section>
    <h1 class="text-2xl font-bold mb-6">
      {{ site?.siteTitle || `${lang.toUpperCase()} Home` }}
    </h1>
    <p
      v-if="site?.siteSubTitle"
      class="text-sm text-gray-500 dark:text-gray-400 mb-6"
    >
      {{ site.siteSubTitle }}
    </p>

    <div v-if="listRes?.list?.length" class="grid gap-4 sm:grid-cols-2">
      <PostCard
        v-for="post in listRes.list"
        :key="post._id"
        :post="post"
        :lang="lang"
      />
    </div>
    <p v-else class="text-gray-500">No posts.</p>

    <div class="mt-6">
      <Pagination
        v-if="listRes"
        :page="1"
        :size="listRes.size"
        :total="listRes.total"
        :build-href="buildHref"
      />
    </div>
  </section>
</template>
