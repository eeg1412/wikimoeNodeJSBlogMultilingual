<script setup>
const route = useRoute()
const lang = computed(() => route.params.lang)

if (!isSupportedLang(lang.value)) {
  throw createError({ statusCode: 404, statusMessage: 'Unsupported language' })
}

const page = computed(() => {
  const n = parseInt(route.query.page, 10)
  return Number.isFinite(n) && n > 0 ? n : 1
})
const typeParam = computed(() => route.query.type || '')
const keyword = computed(() => route.query.keyword || '')

const { data: listRes, refresh } = await useAsyncData(
  () =>
    `post-list-${lang.value}-${page.value}-${typeParam.value}-${keyword.value}`,
  () =>
    fetchPostList({
      lang: lang.value,
      page: page.value,
      type: typeParam.value || undefined,
      keyword: keyword.value || undefined
    })
)

const langs = useSupportedLanguages()
useBlogSeo({
  lang: lang.value,
  path: `/${lang.value}/post/list${page.value > 1 ? `?page=${page.value}` : ''}`,
  alternates: langs.map(code => ({
    languageCode: code,
    path: `/${code}/post/list`
  }))
})

function buildHref(target) {
  const qs = { ...route.query }
  if (target === 1) delete qs.page
  else qs.page = String(target)
  const str = Object.keys(qs)
    .map(k => `${k}=${encodeURIComponent(qs[k])}`)
    .join('&')
  return `/${lang.value}/post/list${str ? `?${str}` : ''}`
}
</script>

<template>
  <section>
    <h1 class="text-xl font-bold mb-4">Post List</h1>
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
        :page="page"
        :size="listRes.size"
        :total="listRes.total"
        :build-href="buildHref"
      />
    </div>
  </section>
</template>
