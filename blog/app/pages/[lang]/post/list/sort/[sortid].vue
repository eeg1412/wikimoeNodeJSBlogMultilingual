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
    fetchPostList({ lang: lang.value, page: page.value, sortid: sortid.value })
)

const sort = computed(() => sortRes.value?.data || null)
const langs = useSupportedLanguages()

watchEffect(() => {
  useBlogSeo({
    lang: lang.value,
    path: `/${lang.value}/post/list/sort/${encodeURIComponent(sortid.value)}${page.value > 1 ? `?page=${page.value}` : ''}`,
    title: sort.value?.sortname,
    description: sort.value?.description,
    alternates: langs.map(code => ({ languageCode: code, path: `/${code}` }))
  })
})

function buildHref(target) {
  const base = `/${lang.value}/post/list/sort/${encodeURIComponent(sortid.value)}`
  if (target === 1) return base
  return `${base}?page=${target}`
}
</script>

<template>
  <div class="taxonomy-page">
    <section class="taxonomy-hero">
      <div class="taxonomy-eyebrow">Category</div>
      <h1 class="taxonomy-title">{{ sort?.sortname || '分类' }}</h1>
      <p class="taxonomy-subtitle">
        {{ sort?.description || '查看该分类及其子分类下的公开内容。' }}
      </p>
      <div class="taxonomy-meta">共 {{ listRes?.total || 0 }} 条内容</div>
    </section>

    <div v-if="listRes?.list?.length" class="taxonomy-grid">
      <PostCard
        v-for="post in listRes.list"
        :key="post._id"
        :post="post"
        :lang="lang"
      />
    </div>
    <div v-else class="taxonomy-empty">该分类暂无公开内容。</div>

    <Pagination
      v-if="listRes"
      :page="page"
      :size="listRes.size"
      :total="listRes.total"
      :build-href="buildHref"
    />
  </div>
</template>

<style scoped>
.taxonomy-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.taxonomy-hero,
.taxonomy-empty {
  border-radius: 30px;
  padding: 24px;
  border: 1px solid rgba(23, 32, 51, 0.08);
  background: rgba(255, 255, 255, 0.74);
}

:global(.dark) .taxonomy-hero,
:global(.dark) .taxonomy-empty {
  background: rgba(17, 24, 39, 0.76);
  border-color: rgba(255, 255, 255, 0.08);
}

.taxonomy-eyebrow {
  color: #8a6d46;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

:global(.dark) .taxonomy-eyebrow {
  color: #9bc5ff;
}

.taxonomy-title {
  margin: 10px 0 0;
  font-size: 34px;
  font-family: 'Palatino Linotype', 'Book Antiqua', 'Noto Serif SC', serif;
}

.taxonomy-subtitle,
.taxonomy-meta,
.taxonomy-empty {
  color: #62748d;
  line-height: 1.8;
}

:global(.dark) .taxonomy-subtitle,
:global(.dark) .taxonomy-meta,
:global(.dark) .taxonomy-empty {
  color: #c7d2e5;
}

.taxonomy-meta {
  margin-top: 12px;
}

.taxonomy-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 960px) {
  .taxonomy-grid {
    grid-template-columns: 1fr;
  }
}
</style>
