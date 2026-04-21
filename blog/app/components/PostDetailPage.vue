<template>
  <article v-if="post" class="space-y-10">
    <section class="glass-panel overflow-hidden p-8 sm:p-10">
      <div class="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
        <div class="space-y-5">
          <div
            class="text-xs uppercase tracking-[0.28em] text-accent-700 dark:text-accent-300"
          >
            {{ post.type === 1 ? 'POST' : 'TWEET' }}
          </div>
          <h1 class="font-display text-4xl leading-tight sm:text-5xl">
            {{ post.title }}
          </h1>
          <p
            class="max-w-2xl text-lg leading-8 text-stone-600 dark:text-stone-300"
          >
            {{ post.excerpt }}
          </p>
          <div
            class="flex flex-wrap gap-4 text-sm text-stone-500 dark:text-stone-400"
          >
            <span>{{ formatDate(post.date) }}</span>
            <span v-if="post.author">作者：{{ post.author.nickname }}</span>
            <span v-if="post.sort">分类：{{ post.sort.sortname }}</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <NuxtLink
              v-for="tag in post.tags || []"
              :key="tag._id"
              :to="`/${languageCode}/post/list/tag/${tag.sourceId || tag._id}`"
              class="rounded-full bg-accent-100 px-3 py-1 text-xs font-medium text-accent-700 dark:bg-accent-900/40 dark:text-accent-200"
            >
              {{ tag.tagname }}
            </NuxtLink>
          </div>
        </div>
        <div
          v-if="coverUrl"
          class="overflow-hidden rounded-3xl border border-stone-200/70 dark:border-white/10"
        >
          <img
            :src="coverUrl"
            :alt="post.title"
            class="h-full w-full object-cover"
          />
        </div>
      </div>
    </section>

    <section class="glass-panel p-8 sm:p-10">
      <HtmlContentBlock :content="post.content" />
    </section>

    <section v-if="voteList.length > 0" class="grid gap-6 lg:grid-cols-2">
      <ReadonlyVoteCard v-for="vote in voteList" :key="vote._id" :vote="vote" />
    </section>

    <section v-if="relatedPosts.length > 0" class="space-y-5">
      <div class="text-xl font-display">更多关联内容</div>
      <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <PostCard
          v-for="relatedPost in relatedPosts"
          :key="relatedPost._id"
          :language-code="languageCode"
          :post="relatedPost"
        />
      </div>
    </section>
  </article>
</template>

<script setup>
import HtmlContentBlock from '@/components/HtmlContentBlock.vue'
import PostCard from '@/components/PostCard.vue'
import ReadonlyVoteCard from '@/components/ReadonlyVoteCard.vue'
import { useSiteOptions } from '@/composables/useSiteOptions'
import { formatDate, resolveAttachmentUrl } from '@/utils/site'

const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const languageCode = computed(() => String(route.params.lang || 'en'))
const { options } = await useSiteOptions(languageCode)

const { data: post } = await useAsyncData(
  () => `post-detail:${route.fullPath}`,
  () =>
    $fetch(`${runtimeConfig.public.apiDomain}/api/blog/post/detail`, {
      params: {
        id: route.params.id,
        lang: languageCode.value
      }
    }).then(response => response.data),
  {
    watch: [() => route.fullPath]
  }
)

if (!post.value) {
  throw createError({ statusCode: 404, statusMessage: 'Not Found' })
}

const coverUrl = computed(() =>
  post.value.coverImages?.[0]
    ? resolveAttachmentUrl(post.value.coverImages[0], runtimeConfig)
    : ''
)
const voteList = computed(() => [
  ...(post.value.voteList || []),
  ...(post.value.contentVoteList || [])
])
const relatedPosts = computed(() => [
  ...(post.value.postList || []),
  ...(post.value.tweetList || []),
  ...(post.value.contentPostList || []),
  ...(post.value.contentTweetList || [])
])

useSeoMeta({
  description: () => post.value.excerpt,
  title: () => post.value.title
})

useHead(() => ({
  link: [
    {
      rel: 'canonical',
      href: `${runtimeConfig.public.siteOrigin.replace(/\/$/, '')}/${languageCode.value}/post/${post.value.alias || post.value.sourceId}`
    },
    ...(post.value.alternates || []).map(item => ({
      rel: 'alternate',
      hreflang: item.languageCode,
      href: `${runtimeConfig.public.siteOrigin.replace(/\/$/, '')}/${item.languageCode}/post/${item.alias}`
    }))
  ]
}))
</script>
