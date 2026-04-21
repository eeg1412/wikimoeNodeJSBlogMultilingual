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
  <div class="place-page">
    <section class="place-hero">
      <div class="place-eyebrow">Mappoint</div>
      <h1 class="place-title">{{ mp?.title || '地点' }}</h1>
      <p class="place-subtitle">
        {{ mp?.summary || '浏览与该地点相关的公开内容。' }}
      </p>
      <div class="place-meta">
        <span
          >经纬度：{{ mp?.longitude || '-' }}, {{ mp?.latitude || '-' }}</span
        >
        <span>共 {{ listRes?.total || 0 }} 条内容</span>
      </div>
    </section>

    <div v-if="listRes?.list?.length" class="place-grid">
      <PostCard
        v-for="post in listRes.list"
        :key="post._id"
        :post="post"
        :lang="lang"
      />
    </div>
    <div v-else class="place-empty">该地点下暂无公开内容。</div>

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
.place-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.place-hero,
.place-empty {
  border-radius: 30px;
  padding: 24px;
  border: 1px solid rgba(23, 32, 51, 0.08);
  background: rgba(255, 255, 255, 0.74);
}

:global(.dark) .place-hero,
:global(.dark) .place-empty {
  background: rgba(17, 24, 39, 0.76);
  border-color: rgba(255, 255, 255, 0.08);
}

.place-eyebrow {
  color: #8a6d46;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

:global(.dark) .place-eyebrow {
  color: #9bc5ff;
}

.place-title {
  margin: 10px 0 0;
  font-size: 34px;
  font-family: 'Palatino Linotype', 'Book Antiqua', 'Noto Serif SC', serif;
}

.place-subtitle,
.place-meta,
.place-empty {
  color: #62748d;
  line-height: 1.8;
}

:global(.dark) .place-subtitle,
:global(.dark) .place-meta,
:global(.dark) .place-empty {
  color: #c7d2e5;
}

.place-meta {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.place-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 960px) {
  .place-grid {
    grid-template-columns: 1fr;
  }
}
</style>
