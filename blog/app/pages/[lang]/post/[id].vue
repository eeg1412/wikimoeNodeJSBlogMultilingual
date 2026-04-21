<script setup>
const route = useRoute()
const lang = computed(() => route.params.lang)
const id = computed(() => String(route.params.id))

if (!isSupportedLang(lang.value)) {
  throw createError({ statusCode: 404, statusMessage: 'Unsupported language' })
}

await ensureSiteOptions()

const { data: detailRes } = await useAsyncData(
  () => `post-detail-${lang.value}-${id.value}`,
  async () => {
    try {
      return await fetchPostDetail({ lang: lang.value, id: id.value })
    } catch (e) {
      const status = e?.response?.status || e?.statusCode
      if (status === 404) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Post not found',
          fatal: true
        })
      }
      throw e
    }
  }
)

const post = computed(() => detailRes.value?.data || null)
const currentPath = computed(() => {
  const idPart = post.value?.alias || post.value?._id || id.value
  return `/${lang.value}/post/${encodeURIComponent(idPart)}`
})
const alternates = computed(() => {
  const arr = post.value?.alternates || []
  return arr.map(item => ({
    languageCode: item.languageCode,
    path: `/${item.languageCode}/post/${encodeURIComponent(item.alias || item._id)}`
  }))
})
const resolvedContent = computed(() => {
  if (!post.value?.content) return ''
  return resolveHtmlAssets(post.value.content)
})
const cover = computed(() => {
  const list = post.value?.coverImages
  if (Array.isArray(list) && list.length > 0) return list[0]
  return null
})
const dateText = computed(() => {
  const date = post.value?.date
  if (!date) return ''
  try {
    return new Date(date).toISOString().slice(0, 10)
  } catch (_) {
    return ''
  }
})
const recommendedPosts = computed(() => [
  ...(post.value?.postList || []),
  ...(post.value?.tweetList || [])
])
const inContentPosts = computed(() => [
  ...(post.value?.contentPostList || []),
  ...(post.value?.contentTweetList || [])
])
const voteList = computed(() => [
  ...(post.value?.voteList || []),
  ...(post.value?.contentVoteList || [])
])
const relatedEntityGroups = computed(() => {
  return [
    { title: '推荐番剧', items: post.value?.bangumiList || [] },
    { title: '推荐电影', items: post.value?.movieList || [] },
    { title: '推荐游戏', items: post.value?.gameList || [] },
    { title: '推荐书籍', items: post.value?.bookList || [] },
    { title: '推荐活动', items: post.value?.eventList || [] },
    { title: '正文关联番剧', items: post.value?.contentBangumiList || [] },
    { title: '正文关联电影', items: post.value?.contentMovieList || [] },
    { title: '正文关联游戏', items: post.value?.contentGameList || [] },
    { title: '正文关联书籍', items: post.value?.contentBookList || [] },
    { title: '正文关联活动', items: post.value?.contentEventList || [] }
  ].filter(group => Array.isArray(group.items) && group.items.length)
})

const { postBottomEnabled: adBottomEnabled, postBottomParams: adBottomParams } =
  useGoogleAds()

watchEffect(() => {
  if (!post.value) return
  useBlogSeo({
    lang: lang.value,
    path: currentPath.value,
    title: post.value.title,
    description: post.value.excerpt,
    ogType: 'article',
    alternates: alternates.value
  })
})

function entityLabel(item) {
  return (
    item?.title ||
    item?.name ||
    item?.sortname ||
    item?.tagname ||
    item?.summary ||
    item?._id ||
    '未命名条目'
  )
}

function relatedPostUrl(item) {
  return `/${lang.value}/post/${encodeURIComponent(item.alias || item._id)}`
}
</script>

<template>
  <article v-if="post" class="post-detail-page">
    <section class="post-detail-hero">
      <div class="post-detail-hero-copy">
        <div class="post-detail-kicker">
          {{ post.type === 2 ? 'Tweet' : 'Article' }}
        </div>
        <h1 class="post-detail-title">{{ post.title }}</h1>
        <p v-if="post.excerpt" class="post-detail-excerpt">
          {{ post.excerpt }}
        </p>

        <div class="post-detail-meta-line">
          <span v-if="dateText">{{ dateText }}</span>
          <span v-if="post.author">作者：{{ post.author.nickname }}</span>
          <NuxtLink
            v-if="post.sort"
            :to="`/${lang}/post/list/sort/${encodeURIComponent(post.sort.alias || post.sort._id)}`"
            class="post-detail-inline-link"
          >
            分类：{{ post.sort.sortname }}
          </NuxtLink>
        </div>

        <div v-if="post.tags?.length" class="post-detail-tag-list">
          <NuxtLink
            v-for="tag in post.tags"
            :key="tag._id"
            :to="`/${lang}/post/list/tag/${encodeURIComponent(tag._id)}`"
            class="post-detail-pill"
          >
            #{{ tag.tagname }}
          </NuxtLink>
        </div>
      </div>

      <div v-if="cover" class="post-detail-hero-cover">
        <img :src="cover.url" :alt="cover.name || post.title" />
      </div>
    </section>

    <div class="post-detail-layout">
      <div class="post-detail-main">
        <section class="post-detail-content-card">
          <div
            class="post-detail-content article-content"
            v-html="resolvedContent"
          ></div>
        </section>

        <GoogleAd
          v-if="adBottomEnabled"
          :params="adBottomParams"
          slot-class="post-detail-ad-bottom"
        />

        <section
          v-if="recommendedPosts.length"
          class="post-detail-section-card"
        >
          <div class="post-detail-section-head">
            <div>
              <div class="post-detail-section-kicker">Related</div>
              <h2 class="post-detail-section-title">详情页推荐</h2>
            </div>
          </div>
          <div class="post-detail-post-grid">
            <PostCard
              v-for="item in recommendedPosts"
              :key="item._id"
              :post="item"
              :lang="lang"
            />
          </div>
        </section>

        <section v-if="inContentPosts.length" class="post-detail-section-card">
          <div class="post-detail-section-head">
            <div>
              <div class="post-detail-section-kicker">In Article</div>
              <h2 class="post-detail-section-title">正文内延伸阅读</h2>
            </div>
          </div>
          <div class="post-detail-post-grid">
            <PostCard
              v-for="item in inContentPosts"
              :key="item._id"
              :post="item"
              :lang="lang"
            />
          </div>
        </section>

        <section
          v-if="relatedEntityGroups.length"
          class="post-detail-section-card"
        >
          <div class="post-detail-section-head">
            <div>
              <div class="post-detail-section-kicker">Entity</div>
              <h2 class="post-detail-section-title">关联条目</h2>
            </div>
          </div>
          <div class="post-detail-entity-groups">
            <div
              v-for="group in relatedEntityGroups"
              :key="group.title"
              class="post-detail-entity-group"
            >
              <h3 class="post-detail-entity-title">{{ group.title }}</h3>
              <div class="post-detail-entity-list">
                <span
                  v-for="item in group.items"
                  :key="item._id"
                  class="post-detail-entity-pill"
                >
                  {{ entityLabel(item) }}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section v-if="voteList.length" class="post-detail-section-card">
          <div class="post-detail-section-head">
            <div>
              <div class="post-detail-section-kicker">Vote</div>
              <h2 class="post-detail-section-title">只读投票信息</h2>
            </div>
          </div>
          <div class="post-detail-vote-list">
            <VoteReadonly
              v-for="vote in voteList"
              :key="vote._id"
              :vote="vote"
            />
          </div>
        </section>
      </div>

      <aside class="post-detail-side">
        <section class="post-detail-side-card">
          <div class="post-detail-side-head">版本信息</div>
          <div class="post-detail-side-list">
            <div>语言：{{ post.languageCode }}</div>
            <div>文章类型：{{ post.type === 2 ? '推文' : '博文' }}</div>
            <div>alias：{{ post.alias || '未设置' }}</div>
            <div>groupSourceId：{{ post.groupSourceId }}</div>
          </div>
        </section>

        <section v-if="post.author" class="post-detail-side-card">
          <div class="post-detail-side-head">作者</div>
          <div class="post-detail-author-card">
            <img
              v-if="post.author.photo?.url"
              :src="post.author.photo.url"
              :alt="post.author.nickname"
              class="post-detail-author-avatar"
            />
            <div>
              <div class="post-detail-author-name">
                {{ post.author.nickname }}
              </div>
              <p v-if="post.author.description" class="post-detail-author-desc">
                {{ post.author.description }}
              </p>
            </div>
          </div>
        </section>

        <section v-if="post.mappointList?.length" class="post-detail-side-card">
          <div class="post-detail-side-head">地点</div>
          <div class="post-detail-side-list">
            <NuxtLink
              v-for="item in post.mappointList"
              :key="item._id"
              :to="`/${lang}/post/list/mappoint/${encodeURIComponent(item._id)}`"
              class="post-detail-inline-link"
            >
              {{ item.title }}
            </NuxtLink>
          </div>
        </section>

        <section
          v-if="post.alternates?.length > 1"
          class="post-detail-side-card"
        >
          <div class="post-detail-side-head">其他语言</div>
          <div class="post-detail-alt-list">
            <template v-for="alt in post.alternates" :key="alt._id">
              <span v-if="alt.isCurrent" class="post-detail-pill is-active">
                {{ alt.languageCode.toUpperCase() }}
              </span>
              <NuxtLink
                v-else
                :to="relatedPostUrl(alt)"
                class="post-detail-pill"
              >
                {{ alt.languageCode.toUpperCase() }}
              </NuxtLink>
            </template>
          </div>
        </section>
      </aside>
    </div>
  </article>
</template>

<style scoped>
.post-detail-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.post-detail-hero,
.post-detail-content-card,
.post-detail-section-card,
.post-detail-side-card {
  border-radius: 32px;
  padding: 24px;
  border: 1px solid rgba(23, 32, 51, 0.08);
  background: rgba(255, 255, 255, 0.76);
  box-shadow: 0 18px 44px rgba(23, 32, 51, 0.06);
}

:global(.dark) .post-detail-hero,
:global(.dark) .post-detail-content-card,
:global(.dark) .post-detail-section-card,
:global(.dark) .post-detail-side-card {
  background: rgba(17, 24, 39, 0.78);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: none;
}

.post-detail-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.9fr);
  gap: 18px;
}

.post-detail-kicker,
.post-detail-section-kicker {
  color: #8a6d46;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

:global(.dark) .post-detail-kicker,
:global(.dark) .post-detail-section-kicker {
  color: #9bc5ff;
}

.post-detail-title,
.post-detail-section-title {
  margin: 10px 0 0;
  font-size: 42px;
  line-height: 1.1;
  font-family: 'Palatino Linotype', 'Book Antiqua', 'Noto Serif SC', serif;
}

.post-detail-section-title {
  font-size: 28px;
}

.post-detail-excerpt,
.post-detail-meta-line,
.post-detail-author-desc,
.post-detail-side-list {
  color: #62748d;
  line-height: 1.9;
}

:global(.dark) .post-detail-excerpt,
:global(.dark) .post-detail-meta-line,
:global(.dark) .post-detail-author-desc,
:global(.dark) .post-detail-side-list {
  color: #c7d2e5;
}

.post-detail-meta-line,
.post-detail-tag-list,
.post-detail-alt-list,
.post-detail-entity-list {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 16px;
}

.post-detail-inline-link,
.post-detail-pill,
.post-detail-entity-pill {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  color: inherit;
  border-radius: 999px;
  padding: 8px 12px;
  border: 1px solid rgba(23, 32, 51, 0.12);
  background: rgba(23, 32, 51, 0.04);
}

:global(.dark) .post-detail-inline-link,
:global(.dark) .post-detail-pill,
:global(.dark) .post-detail-entity-pill {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
}

.post-detail-pill.is-active {
  background: #172033;
  color: #ffffff;
  border-color: #172033;
}

:global(.dark) .post-detail-pill.is-active {
  background: #f8fafc;
  color: #0f172a;
  border-color: #f8fafc;
}

.post-detail-hero-cover {
  aspect-ratio: 16 / 10;
  overflow: hidden;
  border-radius: 26px;
}

.post-detail-hero-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.post-detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 16px;
}

.post-detail-main,
.post-detail-side {
  min-width: 0;
}

.post-detail-main {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.post-detail-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.post-detail-side-head {
  font-weight: 700;
  margin-bottom: 12px;
}

.post-detail-author-card {
  display: flex;
  gap: 14px;
}

.post-detail-author-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  object-fit: cover;
}

.post-detail-author-name {
  font-weight: 700;
}

.post-detail-post-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.post-detail-entity-groups {
  display: grid;
  gap: 18px;
}

.post-detail-entity-title {
  margin: 0 0 10px;
  font-size: 16px;
}

.post-detail-vote-list {
  display: grid;
  gap: 16px;
}

.article-content {
  font-size: 16px;
  line-height: 1.95;
  color: #23314a;
}

:global(.dark) .article-content {
  color: #e2e8f0;
}

.article-content :deep(h1),
.article-content :deep(h2),
.article-content :deep(h3),
.article-content :deep(h4) {
  margin: 1.8em 0 0.8em;
  font-family: 'Palatino Linotype', 'Book Antiqua', 'Noto Serif SC', serif;
  line-height: 1.3;
}

.article-content :deep(p),
.article-content :deep(ul),
.article-content :deep(ol),
.article-content :deep(blockquote),
.article-content :deep(pre) {
  margin: 1em 0;
}

.article-content :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 20px;
}

.article-content :deep(a) {
  color: #2563eb;
}

.article-content :deep(blockquote) {
  padding-left: 18px;
  border-left: 4px solid rgba(37, 99, 235, 0.35);
  color: #52637d;
}

:global(.dark) .article-content :deep(blockquote) {
  color: #cbd5e1;
}

.article-content :deep(pre) {
  overflow: auto;
  border-radius: 18px;
  padding: 16px;
  background: rgba(15, 23, 42, 0.08);
}

:global(.dark) .article-content :deep(pre) {
  background: rgba(255, 255, 255, 0.08);
}

@media (max-width: 1200px) {
  .post-detail-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 960px) {
  .post-detail-hero,
  .post-detail-post-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .post-detail-hero,
  .post-detail-content-card,
  .post-detail-section-card,
  .post-detail-side-card {
    padding: 20px;
  }

  .post-detail-title {
    font-size: 32px;
  }
}
</style>
