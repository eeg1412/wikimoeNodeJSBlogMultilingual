<template>
  <article class="glass-panel overflow-hidden">
    <NuxtLink :to="detailPath" class="block h-full">
      <div v-if="coverUrl" class="aspect-[16/9] overflow-hidden">
        <img :src="coverUrl" :alt="post.title" class="h-full w-full object-cover transition duration-500 hover:scale-105" />
      </div>
      <div class="space-y-4 p-6">
        <div class="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400">
          <span>{{ post.type === 1 ? 'POST' : 'TWEET' }}</span>
          <span>{{ formatDate(post.date) }}</span>
        </div>
        <h2 class="font-display text-2xl leading-tight text-stone-900 dark:text-white">
          {{ post.title }}
        </h2>
        <p class="line-clamp-3 text-sm leading-7 text-stone-600 dark:text-stone-300">
          {{ post.excerpt }}
        </p>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="tag in post.tags?.slice(0, 3) || []"
            :key="tag._id"
            class="rounded-full bg-accent-100 px-3 py-1 text-xs font-medium text-accent-700 dark:bg-accent-900/40 dark:text-accent-200"
          >
            {{ tag.tagname }}
          </span>
        </div>
      </div>
    </NuxtLink>
  </article>
</template>

<script setup>
import { formatDate, resolveAttachmentUrl } from '@/utils/site'

const props = defineProps({
  languageCode: {
    type: String,
    required: true
  },
  post: {
    type: Object,
    required: true
  }
})

const runtimeConfig = useRuntimeConfig()
const coverUrl = computed(() =>
  props.post.coverImages?.[0]
    ? resolveAttachmentUrl(props.post.coverImages[0], runtimeConfig)
    : ''
)
const detailPath = computed(() => `/${props.languageCode}/post/${props.post.alias || props.post.sourceId}`)
</script>