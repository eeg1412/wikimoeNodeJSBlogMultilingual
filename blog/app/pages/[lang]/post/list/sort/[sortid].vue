<script setup>
const route = useRoute()
const lang = computed(() => route.params.lang)
const sortid = computed(() => String(route.params.sortid))

if (!isSupportedLang(lang.value)) {
  throw createError({ statusCode: 404, statusMessage: 'Unsupported language' })
}

const page = computed(() => {
  const n = parseInt(route.query.page, 10)
  return Number.isFinite(n) && n > 0 ? n : 1
})

const { data: sortRes } = await useAsyncData(
  () => `sort-detail-${lang.value}-${sortid.value}`,
  async () => {
    try {
      return await fetchSortDetail({ lang: lang.value, id: sortid.value })
    } catch (e) {
      const status = e?.response?.status || e?.statusCode
      if (status === 404) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Sort not found',
          fatal: true
        })
      }
      throw e
    }
  }
)

const { data: listRes } = await useAsyncData(
  () => `post-list-sort-${lang.value}-${sortid.value}-${page.value}`,
  () =>
    fetchPostList({
      lang: lang.value,
      page: page.value,
      sortid: sortid.value
    })
)

const sort = computed(() => sortRes.value?.data || null)
const langs = useSupportedLanguages()

watchEffect(() => {
  useBlogSeo({
    lang: lang.value,
    path: `/${lang.value}/post/list/sort/${encodeURIComponent(sortid.value)}${page.value > 1 ? `?page=${page.value}` : ''}`,
    title: sort.value?.sortname,
    description: sort.value?.description,
    alternates: langs.map(code => ({
      languageCode: code,
      path: `/${code}`
    }))
  })
})

function buildHref(target) {
  const base = `/${lang.value}/post/list/sort/${encodeURIComponent(sortid.value)}`
  if (target === 1) return base
  return `${base}?page=${target}`
}
</script>

<template>
  <section>
    <header class="mb-6">
      <h1 class="text-xl font-bold">
        {{ sort?.sortname || 'Sort' }}
      </h1>
      <p
        v-if="sort?.description"
        class="text-sm text-gray-500 dark:text-gray-400 mt-1"
      >
        {{ sort.description }}
      </p>
    </header>
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
