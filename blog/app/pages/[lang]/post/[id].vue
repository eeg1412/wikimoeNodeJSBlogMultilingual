<script setup>
const route = useRoute()
const lang = computed(() => route.params.lang)
const id = computed(() => String(route.params.id))

if (!isSupportedLang(lang.value)) {
  throw createError({ statusCode: 404, statusMessage: 'Unsupported language' })
}

const { data: detailRes, error } = await useAsyncData(
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
  return arr.map(a => ({
    languageCode: a.languageCode,
    path: `/${a.languageCode}/post/${encodeURIComponent(a.alias || a._id)}`
  }))
})

// SEO 注入
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

// 正文 HTML 资源路径运行时改写
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
  const d = post.value?.date
  if (!d) return ''
  try {
    return new Date(d).toISOString().slice(0, 10)
  } catch (err) {
    return ''
  }
})

const { postBottomEnabled: adBottomEnabled, postBottomParams: adBottomParams } =
  useGoogleAds()
</script>

<template>
  <article v-if="post" class="post-detail">
    <header class="post-detail-header mb-6">
      <h1 class="post-detail-title text-2xl font-bold mb-2">
        {{ post.title }}
      </h1>
      <div
        class="post-detail-meta text-sm text-gray-500 dark:text-gray-400 flex flex-wrap gap-3"
      >
        <span v-if="dateText">{{ dateText }}</span>
        <span v-if="post.author">{{ post.author.nickname }}</span>
        <span v-if="post.sort">
          <NuxtLink
            :to="`/${lang}/post/list/sort/${post.sort.alias || post.sort._id}`"
            class="hover:underline"
          >
            {{ post.sort.sortname }}
          </NuxtLink>
        </span>
      </div>
      <ul
        v-if="post.tags?.length"
        class="post-detail-tags mt-3 flex flex-wrap gap-2"
      >
        <li v-for="t in post.tags" :key="t._id">
          <NuxtLink
            :to="`/${lang}/post/list?tagid=${t._id}`"
            class="px-2 py-0.5 text-xs rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            #{{ t.tagname }}
          </NuxtLink>
        </li>
      </ul>
    </header>

    <figure v-if="cover" class="post-detail-cover mb-6">
      <img
        :src="cover.url"
        :alt="cover.name || post.title"
        class="w-full rounded-lg"
      />
    </figure>

    <div
      class="post-detail-content prose dark:prose-invert max-w-none"
      v-html="resolvedContent"
    ></div>

    <GoogleAd
      v-if="adBottomEnabled"
      :params="adBottomParams"
      slot-class="post-detail-ad-bottom"
    />

    <section
      v-if="post.voteList?.length || post.contentVoteList?.length"
      class="post-detail-votes mt-8 space-y-4"
    >
      <VoteReadonly
        v-for="vote in [
          ...(post.voteList || []),
          ...(post.contentVoteList || [])
        ]"
        :key="vote._id"
        :vote="vote"
      />
    </section>

    <section
      v-if="post.alternates?.length > 1"
      class="post-detail-alternates mt-8 border-t border-gray-200 dark:border-gray-800 pt-4 text-sm"
    >
      <h3 class="font-semibold mb-2">Other languages</h3>
      <ul class="flex gap-3">
        <li v-for="alt in post.alternates" :key="alt._id">
          <NuxtLink
            v-if="!alt.isCurrent"
            :to="`/${alt.languageCode}/post/${encodeURIComponent(alt.alias || alt._id)}`"
            class="text-blue-500 hover:underline"
          >
            {{ alt.languageCode.toUpperCase() }}
          </NuxtLink>
          <span v-else class="text-gray-400">{{
            alt.languageCode.toUpperCase()
          }}</span>
        </li>
      </ul>
    </section>
  </article>
</template>
