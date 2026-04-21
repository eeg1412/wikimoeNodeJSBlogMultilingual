<script setup>
const route = useRoute()
const lang = computed(() => route.params.lang)
const mappointid = computed(() => String(route.params.mappointid))

if (!isSupportedLang(lang.value)) {
  throw createError({ statusCode: 404, statusMessage: 'Unsupported language' })
}

const page = computed(() => {
  const n = parseInt(route.query.page, 10)
  return Number.isFinite(n) && n > 0 ? n : 1
})

const { data: mpRes } = await useAsyncData(
  () => `mappoint-detail-${lang.value}-${mappointid.value}`,
  async () => {
    try {
      return await fetchMappointDetail({
        lang: lang.value,
        id: mappointid.value
      })
    } catch (e) {
      const status = e?.response?.status || e?.statusCode
      if (status === 404) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Mappoint not found',
          fatal: true
        })
      }
      throw e
    }
  }
)

const { data: listRes } = await useAsyncData(
  () => `post-list-mappoint-${lang.value}-${mappointid.value}-${page.value}`,
  () =>
    fetchPostList({
      lang: lang.value,
      page: page.value,
      mappointid: mappointid.value
    })
)

const mp = computed(() => mpRes.value?.data || null)

watchEffect(() => {
  useBlogSeo({
    lang: lang.value,
    path: `/${lang.value}/post/list/mappoint/${encodeURIComponent(mappointid.value)}${page.value > 1 ? `?page=${page.value}` : ''}`,
    title: mp.value?.title,
    description: mp.value?.summary
  })
})

function buildHref(target) {
  const base = `/${lang.value}/post/list/mappoint/${encodeURIComponent(mappointid.value)}`
  if (target === 1) return base
  return `${base}?page=${target}`
}
</script>

<template>
  <section>
    <header class="mb-6">
      <h1 class="text-xl font-bold">📍 {{ mp?.title || 'Mappoint' }}</h1>
      <p
        v-if="mp?.summary"
        class="text-sm text-gray-500 dark:text-gray-400 mt-1"
      >
        {{ mp.summary }}
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
