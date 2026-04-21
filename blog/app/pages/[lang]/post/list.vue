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
const typeParam = computed(() =>
  typeof route.query.type === 'string' ? route.query.type : ''
)
const keyword = computed(() =>
  typeof route.query.keyword === 'string' ? route.query.keyword : ''
)
const year = computed(() =>
  typeof route.query.year === 'string' ? route.query.year : ''
)
const month = computed(() =>
  typeof route.query.month === 'string' ? route.query.month : ''
)

const { data: listRes } = await useAsyncData(
  () =>
    `post-list-${lang.value}-${page.value}-${typeParam.value}-${keyword.value}-${year.value}-${month.value}`,
  () =>
    fetchPostList({
      lang: lang.value,
      page: page.value,
      type: typeParam.value || undefined,
      keyword: keyword.value || undefined,
      year: year.value || undefined,
      month: month.value || undefined
    })
)

const langs = useSupportedLanguages()
const pageTitle = computed(() => {
  if (keyword.value) return `搜索：${keyword.value}`
  if (year.value && month.value) return `${year.value} / ${month.value} 归档`
  if (typeParam.value === '1') return '博文列表'
  if (typeParam.value === '2') return '推文列表'
  return '全部内容'
})
const pageDescription = computed(() => {
  if (keyword.value) return '按标题、摘要、标签和地点进行关键字筛选。'
  if (year.value && month.value) return '按年月查看该语言下的公开归档内容。'
  if (typeParam.value === '1') return '聚焦篇幅更完整的博文译文。'
  if (typeParam.value === '2') return '快速浏览轻量化的推文条目。'
  return '浏览该语言下全部公开内容。'
})

useBlogSeo({
  lang: lang.value,
  path: `/${lang.value}/post/list${page.value > 1 ? `?page=${page.value}` : ''}`,
  title: pageTitle.value,
  description: pageDescription.value,
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
    .map(key => `${key}=${encodeURIComponent(qs[key])}`)
    .join('&')
  return `/${lang.value}/post/list${str ? `?${str}` : ''}`
}

function typeHref(value) {
  const query = { ...route.query }
  if (!value) delete query.type
  else query.type = value
  delete query.page
  return { path: `/${lang.value}/post/list`, query }
}
</script>

<template>
  <div class="list-page">
    <section class="list-hero">
      <div>
        <div class="list-eyebrow">Archive</div>
        <h1 class="list-title">{{ pageTitle }}</h1>
        <p class="list-subtitle">{{ pageDescription }}</p>
      </div>
      <div class="list-filter-pills">
        <NuxtLink
          :to="typeHref('')"
          class="list-filter-pill"
          :class="{ 'is-active': !typeParam }"
          >全部</NuxtLink
        >
        <NuxtLink
          :to="typeHref('1')"
          class="list-filter-pill"
          :class="{ 'is-active': typeParam === '1' }"
          >博文</NuxtLink
        >
        <NuxtLink
          :to="typeHref('2')"
          class="list-filter-pill"
          :class="{ 'is-active': typeParam === '2' }"
          >推文</NuxtLink
        >
      </div>
    </section>

    <div v-if="keyword || (year && month)" class="list-context-bar">
      <span v-if="keyword">关键词：{{ keyword }}</span>
      <span v-if="year && month">归档：{{ year }} / {{ month }}</span>
      <span>结果数：{{ listRes?.total || 0 }}</span>
    </div>

    <div v-if="listRes?.list?.length" class="list-grid">
      <PostCard
        v-for="post in listRes.list"
        :key="post._id"
        :post="post"
        :lang="lang"
      />
    </div>
    <div v-else class="list-empty">当前条件下没有公开内容。</div>

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
.list-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.list-hero,
.list-context-bar {
  border-radius: 30px;
  padding: 24px;
  border: 1px solid rgba(23, 32, 51, 0.08);
  background: rgba(255, 255, 255, 0.74);
}

:global(.dark) .list-hero,
:global(.dark) .list-context-bar {
  background: rgba(17, 24, 39, 0.76);
  border-color: rgba(255, 255, 255, 0.08);
}

.list-eyebrow {
  color: #8a6d46;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

:global(.dark) .list-eyebrow {
  color: #9bc5ff;
}

.list-title {
  margin: 10px 0 0;
  font-size: 34px;
  font-family: 'Palatino Linotype', 'Book Antiqua', 'Noto Serif SC', serif;
}

.list-subtitle,
.list-context-bar,
.list-empty {
  color: #62748d;
  line-height: 1.8;
}

:global(.dark) .list-subtitle,
:global(.dark) .list-context-bar,
:global(.dark) .list-empty {
  color: #c7d2e5;
}

.list-filter-pills {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 18px;
}

.list-filter-pill {
  text-decoration: none;
  color: inherit;
  padding: 10px 14px;
  border-radius: 999px;
  border: 1px solid rgba(23, 32, 51, 0.12);
  background: rgba(255, 255, 255, 0.82);
}

.list-filter-pill.is-active {
  background: #172033;
  color: #ffffff;
  border-color: #172033;
}

:global(.dark) .list-filter-pill {
  background: rgba(17, 24, 39, 0.84);
  border-color: rgba(255, 255, 255, 0.1);
}

:global(.dark) .list-filter-pill.is-active {
  background: #f8fafc;
  color: #0f172a;
  border-color: #f8fafc;
}

.list-context-bar {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
}

.list-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 960px) {
  .list-grid {
    grid-template-columns: 1fr;
  }
}
</style>
