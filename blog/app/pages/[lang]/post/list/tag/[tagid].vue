<script setup>
const route = useRoute()
const lang = computed(() => route.params.lang)
const tagid = computed(() => String(route.params.tagid))

if (!isSupportedLang(lang.value)) {
  throw createError({ statusCode: 404, statusMessage: 'Unsupported language' })
}

const page = computed(() => {
  const n = parseInt(route.query.page, 10)
  return Number.isFinite(n) && n > 0 ? n : 1
})

const { data: tagRes } = await useAsyncData(
  () => `tag-detail-${lang.value}-${tagid.value}`,
  async () => {
    try {
      return await fetchTagDetail({ lang: lang.value, id: tagid.value })
    } catch (e) {
      const status = e?.response?.status || e?.statusCode
      if (status === 404) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Tag not found',
          fatal: true
        })
      }
      throw e
    }
  }
)

const { data: listRes } = await useAsyncData(
  () => `post-list-tag-${lang.value}-${tagid.value}-${page.value}`,
  () =>
    fetchPostList({
      lang: lang.value,
      page: page.value,
      tagid: tagid.value
    })
)

const tag = computed(() => tagRes.value?.data || null)

watchEffect(() => {
  useBlogSeo({
    lang: lang.value,
    path: `/${lang.value}/post/list/tag/${encodeURIComponent(tagid.value)}${page.value > 1 ? `?page=${page.value}` : ''}`,
    title: tag.value?.tagname
  })
})

function buildHref(target) {
  const base = `/${lang.value}/post/list/tag/${encodeURIComponent(tagid.value)}`
  if (target === 1) return base
  return `${base}?page=${target}`
}
</script>

<template>
  <section>
    <header class="mb-6">
      <h1 class="text-xl font-bold">#{{ tag?.tagname || 'Tag' }}</h1>
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
