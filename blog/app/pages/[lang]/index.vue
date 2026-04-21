<script setup>
const route = useRoute()
const lang = computed(() => route.params.lang)

if (!isSupportedLang(lang.value)) {
  throw createError({ statusCode: 404, statusMessage: 'Unsupported language' })
}

await ensureSiteOptions()

const { data: listRes } = await useAsyncData(
  () => `post-list-${lang.value}-1`,
  () => fetchPostList({ lang: lang.value, page: 1 })
)

const site = useSiteOptions().value || {}
const langs = useSupportedLanguages()
const featuredPost = computed(() => listRes.value?.list?.[0] || null)
const streamPosts = computed(() => (listRes.value?.list || []).slice(1))

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

function featuredUrl(post) {
  return `/${lang.value}/post/${encodeURIComponent(post.alias || post._id)}`
}
</script>

<template>
  <div class="home-page">
    <section class="home-hero">
      <div class="home-copy">
        <div class="home-eyebrow">{{ lang.toUpperCase() }} Edition</div>
        <h1 class="home-title">
          {{ site?.siteTitle || 'Wikimoe Multilingual' }}
        </h1>
        <p class="home-subtitle">
          {{
            site?.siteSubTitle ||
            site?.siteDescription ||
            '浏览当前语言下最新发布的博文与推文。'
          }}
        </p>
        <div class="home-actions">
          <NuxtLink
            :to="`/${lang}/post/list`"
            class="home-action home-action--primary"
            >浏览全部内容</NuxtLink
          >
          <NuxtLink :to="`/${lang}/post/list?type=2`" class="home-action"
            >只看推文</NuxtLink
          >
        </div>
        <div class="home-stats">
          <div class="home-stat-item">
            <div class="home-stat-value">{{ listRes?.total || 0 }}</div>
            <div class="home-stat-label">已发布内容</div>
          </div>
          <div class="home-stat-item">
            <div class="home-stat-value">{{ langs.length }}</div>
            <div class="home-stat-label">可切换语言</div>
          </div>
        </div>
      </div>

      <NuxtLink
        v-if="featuredPost"
        :to="featuredUrl(featuredPost)"
        class="home-featured"
      >
        <div v-if="featuredPost.coverImages?.[0]" class="home-featured-cover">
          <img
            :src="featuredPost.coverImages[0].url"
            :alt="featuredPost.coverImages[0].name || featuredPost.title"
          />
        </div>
        <div class="home-featured-body">
          <div class="home-featured-kicker">Latest Feature</div>
          <h2 class="home-featured-title">{{ featuredPost.title }}</h2>
          <p class="home-featured-excerpt">
            {{ featuredPost.excerpt || '进入详情页查看完整译文与关联内容。' }}
          </p>
          <div class="home-featured-meta">
            <span>{{ featuredPost.sort?.sortname || '未分类' }}</span>
            <span>{{ featuredPost.author?.nickname || '匿名' }}</span>
          </div>
        </div>
      </NuxtLink>
    </section>

    <section class="home-stream">
      <div class="home-section-head">
        <div>
          <div class="home-section-kicker">Fresh Updates</div>
          <h2 class="home-section-title">最新更新</h2>
        </div>
        <NuxtLink :to="`/${lang}/post/list`" class="home-section-link"
          >查看归档</NuxtLink
        >
      </div>

      <div v-if="streamPosts.length" class="home-grid">
        <PostCard
          v-for="post in streamPosts"
          :key="post._id"
          :post="post"
          :lang="lang"
        />
      </div>
      <div v-else class="home-empty">当前语言还没有更多内容。</div>
    </section>

    <Pagination
      v-if="listRes"
      :page="1"
      :size="listRes.size"
      :total="listRes.total"
      :build-href="buildHref"
    />
  </div>
</template>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.home-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.9fr);
  gap: 18px;
}

.home-copy,
.home-featured,
.home-stream {
  border-radius: 32px;
  padding: 24px;
  border: 1px solid rgba(23, 32, 51, 0.08);
  background: rgba(255, 255, 255, 0.74);
  box-shadow: 0 18px 44px rgba(23, 32, 51, 0.06);
}

:global(.dark) .home-copy,
:global(.dark) .home-featured,
:global(.dark) .home-stream {
  background: rgba(17, 24, 39, 0.76);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: none;
}

.home-eyebrow,
.home-section-kicker,
.home-featured-kicker {
  color: #8a6d46;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

:global(.dark) .home-eyebrow,
:global(.dark) .home-section-kicker,
:global(.dark) .home-featured-kicker {
  color: #9bc5ff;
}

.home-title,
.home-section-title,
.home-featured-title {
  margin: 10px 0 0;
  font-family: 'Palatino Linotype', 'Book Antiqua', 'Noto Serif SC', serif;
  color: #172033;
}

:global(.dark) .home-title,
:global(.dark) .home-section-title,
:global(.dark) .home-featured-title {
  color: #f8fafc;
}

.home-title {
  font-size: 42px;
  line-height: 1.08;
}

.home-subtitle,
.home-featured-excerpt,
.home-empty {
  margin: 14px 0 0;
  color: #5f6f89;
  line-height: 1.9;
}

:global(.dark) .home-subtitle,
:global(.dark) .home-featured-excerpt,
:global(.dark) .home-empty {
  color: #c7d2e5;
}

.home-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 20px;
}

.home-action,
.home-section-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  border-radius: 999px;
  padding: 10px 16px;
  border: 1px solid rgba(23, 32, 51, 0.12);
  color: inherit;
}

.home-action--primary,
.home-section-link {
  background: #172033;
  color: #ffffff;
  border-color: #172033;
}

:global(.dark) .home-action,
:global(.dark) .home-section-link {
  border-color: rgba(255, 255, 255, 0.1);
}

:global(.dark) .home-action--primary,
:global(.dark) .home-section-link {
  background: #f8fafc;
  color: #0f172a;
  border-color: #f8fafc;
}

.home-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 24px;
}

.home-stat-item {
  padding: 14px 16px;
  border-radius: 20px;
  background: rgba(23, 32, 51, 0.05);
}

:global(.dark) .home-stat-item {
  background: rgba(255, 255, 255, 0.05);
}

.home-stat-value {
  font-size: 28px;
  font-weight: 700;
}

.home-stat-label {
  font-size: 12px;
  color: #6c7a93;
}

.home-featured {
  display: grid;
  gap: 16px;
  text-decoration: none;
  color: inherit;
}

.home-featured-cover {
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 24px;
}

.home-featured-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.home-featured-meta {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-top: 16px;
  color: #7a879a;
  font-size: 12px;
}

.home-section-head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.home-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 960px) {
  .home-hero,
  .home-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .home-title {
    font-size: 32px;
  }

  .home-copy,
  .home-featured,
  .home-stream {
    padding: 20px;
  }
}
</style>
