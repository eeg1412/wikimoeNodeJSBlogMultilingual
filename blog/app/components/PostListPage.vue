<template>
  <div class="space-y-10">
    <section class="glass-panel overflow-hidden p-8 sm:p-10">
      <div class="grid gap-8 lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
        <div class="space-y-4">
          <div
            class="text-xs uppercase tracking-[0.3em] text-accent-700 dark:text-accent-300"
          >
            {{ headerEyebrow }}
          </div>
          <h1 class="font-display text-4xl leading-tight sm:text-5xl">
            {{ headerTitle }}
          </h1>
          <p
            class="max-w-2xl text-base leading-8 text-stone-600 dark:text-stone-300"
          >
            {{ headerDescription }}
          </p>
        </div>
        <div
          class="grid gap-3 rounded-3xl border border-stone-200/70 bg-white/70 p-5 dark:border-white/10 dark:bg-white/5"
        >
          <div class="text-sm text-stone-500 dark:text-stone-400">
            页面 {{ pageNumber }}
          </div>
          <div class="text-3xl font-semibold">{{ listData?.total || 0 }}</div>
          <div class="text-sm text-stone-500 dark:text-stone-400">
            当前条件下的可见文章数
          </div>
        </div>
      </div>
    </section>

    <section v-if="pending" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="item in 6"
        :key="item"
        class="glass-panel h-72 animate-pulse"
      />
    </section>

    <section
      v-else-if="postList.length > 0"
      class="grid gap-6 sm:grid-cols-2 xl:grid-cols-3"
    >
      <PostCard
        v-for="post in postList"
        :key="post._id"
        :language-code="languageCode"
        :post="post"
      />
    </section>

    <section
      v-else
      class="glass-panel p-10 text-center text-stone-500 dark:text-stone-400"
    >
      当前条件下没有可显示的文章。
    </section>

    <section class="flex items-center justify-between gap-4">
      <NuxtLink
        v-if="pageNumber > 1"
        :to="buildPagePath(pageNumber - 1)"
        class="rounded-full border border-stone-200/70 px-5 py-3 text-sm font-medium hover:border-accent-400 hover:text-accent-700 dark:border-white/10"
      >
        上一页
      </NuxtLink>
      <span v-else />
      <NuxtLink
        v-if="hasNextPage"
        :to="buildPagePath(pageNumber + 1)"
        class="rounded-full border border-stone-200/70 px-5 py-3 text-sm font-medium hover:border-accent-400 hover:text-accent-700 dark:border-white/10"
      >
        下一页
      </NuxtLink>
    </section>
  </div>
</template>

<script setup>
import PostCard from '@/components/PostCard.vue'
import { useSiteOptions } from '@/composables/useSiteOptions'

const props = defineProps({
  filterId: {
    type: String,
    default: ''
  },
  mode: {
    type: String,
    required: true
  },
  page: {
    type: [String, Number],
    default: 1
  },
  type: {
    type: [String, Number],
    default: ''
  }
})

const route = useRoute()
const runtimeConfig = useRuntimeConfig()
const languageCode = computed(() => String(route.params.lang || 'en'))
const pageNumber = computed(() => Math.max(Number(props.page || 1), 1))
const typeValue = computed(() => (props.type ? Number(props.type) : undefined))

const { options } = await useSiteOptions(languageCode)

const listParams = computed(() => {
  const params = {
    lang: languageCode.value,
    limit: options.value.sitePageSize || 12,
    page: pageNumber.value
  }
  if (typeValue.value) {
    params.type = typeValue.value
  }
  if (props.mode === 'sort') {
    params.sort = props.filterId
  }
  if (props.mode === 'tag') {
    params.tag = props.filterId
  }
  if (props.mode === 'mappoint') {
    params.mappoint = props.filterId
  }
  return params
})

const { data: listData, pending } = await useAsyncData(
  () => `post-list:${route.fullPath}`,
  () =>
    $fetch(`${runtimeConfig.public.apiDomain}/api/blog/post/list`, {
      params: listParams.value
    }).then(response => response.data),
  {
    watch: [() => route.fullPath, options]
  }
)

const { data: detailData } = await useAsyncData(
  () =>
    `post-list-detail:${props.mode}:${props.filterId}:${languageCode.value}`,
  async () => {
    if (!['sort', 'tag', 'mappoint'].includes(props.mode) || !props.filterId) {
      return null
    }
    const endpointMap = {
      mappoint: 'mappoint',
      sort: 'sort',
      tag: 'tag'
    }
    return $fetch(
      `${runtimeConfig.public.apiDomain}/api/blog/${endpointMap[props.mode]}/detail`,
      {
        params: {
          id: props.filterId,
          lang: languageCode.value
        }
      }
    ).then(response => response.data)
  },
  {
    watch: [() => route.fullPath],
    default: () => null
  }
)

const postList = computed(() => listData.value?.list || [])
const hasNextPage = computed(
  () =>
    (listData.value?.page || 1) * (listData.value?.limit || 1) <
    (listData.value?.total || 0)
)

const headerEyebrow = computed(() => {
  if (props.mode === 'home') return 'Editorial Stream'
  if (props.mode === 'sort') return 'Sort Archive'
  if (props.mode === 'tag') return 'Tag Archive'
  if (props.mode === 'mappoint') return 'Map Archive'
  return 'Post Index'
})

const headerTitle = computed(() => {
  if (props.mode === 'home')
    return options.value.siteTitle || 'Wikimoe Multilingual'
  if (props.mode === 'sort') return detailData.value?.sortname || '分类列表'
  if (props.mode === 'tag') return detailData.value?.tagname || '标签列表'
  if (props.mode === 'mappoint') return detailData.value?.title || '地点列表'
  return '文章列表'
})

const headerDescription = computed(() => {
  if (props.mode === 'home')
    return options.value.siteDescription || '本地多语言内容流。'
  if (props.mode === 'sort')
    return detailData.value?.description || '按分类浏览多语言文章。'
  if (props.mode === 'tag') return '按标签浏览多语言文章。'
  if (props.mode === 'mappoint')
    return detailData.value?.summary || '按地点浏览多语言文章。'
  return '浏览当前语言下已发布的文章与推文。'
})

function buildPagePath(targetPage) {
  const typeSuffix = typeValue.value ? `/${typeValue.value}` : ''
  if (props.mode === 'home') {
    return targetPage === 1 && !typeValue.value
      ? `/${languageCode.value}`
      : `/${languageCode.value}/post/list/${targetPage}${typeSuffix}`
  }
  if (props.mode === 'sort') {
    return targetPage === 1 && !typeValue.value
      ? `/${languageCode.value}/post/list/sort/${props.filterId}`
      : `/${languageCode.value}/post/list/sort/${props.filterId}/${targetPage}${typeSuffix}`
  }
  if (props.mode === 'tag') {
    return targetPage === 1 && !typeValue.value
      ? `/${languageCode.value}/post/list/tag/${props.filterId}`
      : `/${languageCode.value}/post/list/tag/${props.filterId}/${targetPage}${typeSuffix}`
  }
  if (props.mode === 'mappoint') {
    return targetPage === 1 && !typeValue.value
      ? `/${languageCode.value}/post/list/mappoint/${props.filterId}`
      : `/${languageCode.value}/post/list/mappoint/${props.filterId}/${targetPage}${typeSuffix}`
  }
  return targetPage === 1 && !typeValue.value
    ? `/${languageCode.value}/post/list`
    : `/${languageCode.value}/post/list/${targetPage}${typeSuffix}`
}

useSeoMeta({
  description: () => headerDescription.value,
  title: () => headerTitle.value
})

useHead(() => ({
  link: [
    {
      rel: 'canonical',
      href: `${runtimeConfig.public.siteOrigin.replace(/\/$/, '')}${route.fullPath}`
    }
  ]
}))
</script>
