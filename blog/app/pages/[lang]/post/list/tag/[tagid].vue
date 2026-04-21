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
    fetchPostList({ lang: lang.value, page: page.value, tagid: tagid.value })
)

const tag = computed(() => tagRes.value?.data || null)

watchEffect(() => {
  useBlogSeo({
    lang: lang.value,
    path: `/${lang.value}/post/list/tag/${encodeURIComponent(tagid.value)}${page.value > 1 ? `?page=${page.value}` : ''}`,
    title: tag.value?.tagname,
    description: `标签 #${tag.value?.tagname || ''} 下的公开内容`
  })
})

function buildHref(target) {
  const base = `/${lang.value}/post/list/tag/${encodeURIComponent(tagid.value)}`
  if (target === 1) return base
  return `${base}?page=${target}`
}
</script>

<template>
  <div class="tag-page">
    <section class="tag-hero">
      <div class="tag-eyebrow">Tag</div>
      <h1 class="tag-title">#{{ tag?.tagname || 'Tag' }}</h1>
      <p class="tag-subtitle">查看所有命中该标签的译文条目。</p>
      <div class="tag-meta">共 {{ listRes?.total || 0 }} 条内容</div>
    </section>

    <div v-if="listRes?.list?.length" class="tag-grid">
      <PostCard
        v-for="post in listRes.list"
        :key="post._id"
        :post="post"
        :lang="lang"
      />
    </div>
    <div v-else class="tag-empty">该标签下暂无公开内容。</div>

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
.tag-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.tag-hero,
.tag-empty {
  border-radius: 30px;
  padding: 24px;
  border: 1px solid rgba(23, 32, 51, 0.08);
  background: rgba(255, 255, 255, 0.74);
}

:global(.dark) .tag-hero,
:global(.dark) .tag-empty {
  background: rgba(17, 24, 39, 0.76);
  border-color: rgba(255, 255, 255, 0.08);
}

.tag-eyebrow {
  color: #8a6d46;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

:global(.dark) .tag-eyebrow {
  color: #9bc5ff;
}

.tag-title {
  margin: 10px 0 0;
  font-size: 34px;
  font-family: 'Palatino Linotype', 'Book Antiqua', 'Noto Serif SC', serif;
}

.tag-subtitle,
.tag-meta,
.tag-empty {
  color: #62748d;
  line-height: 1.8;
}

:global(.dark) .tag-subtitle,
:global(.dark) .tag-meta,
:global(.dark) .tag-empty {
  color: #c7d2e5;
}

.tag-meta {
  margin-top: 12px;
}

.tag-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 960px) {
  .tag-grid {
    grid-template-columns: 1fr;
  }
}
</style>
