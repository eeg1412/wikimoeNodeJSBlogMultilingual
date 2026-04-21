<script setup>
const props = defineProps({
  post: { type: Object, required: true },
  lang: { type: String, required: true }
})

const cover = computed(() => {
  const list = props.post?.coverImages
  if (Array.isArray(list) && list.length > 0) return list[0]
  return null
})

const postUrl = computed(() => {
  const id = props.post?.alias || props.post?._id
  return `/${props.lang}/post/${encodeURIComponent(id)}`
})

const dateText = computed(() => {
  const d = props.post?.date
  if (!d) return ''
  try {
    return new Date(d).toISOString().slice(0, 10)
  } catch (err) {
    return ''
  }
})
</script>

<template>
  <article
    class="post-card border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-900 hover:shadow-md transition"
  >
    <NuxtLink :to="postUrl" class="block">
      <div
        v-if="cover"
        class="post-card-cover aspect-video bg-gray-100 dark:bg-gray-800"
      >
        <img
          :src="cover.url"
          :alt="cover.name || post.title"
          loading="lazy"
          class="w-full h-full object-cover"
        />
      </div>
      <div class="post-card-body p-4">
        <h2
          class="post-card-title text-lg font-semibold text-gray-900 dark:text-gray-100 line-clamp-2"
        >
          {{ post.title }}
        </h2>
        <p
          v-if="post.excerpt"
          class="post-card-excerpt mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-3"
        >
          {{ post.excerpt }}
        </p>
        <div
          class="post-card-meta mt-3 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400"
        >
          <span v-if="dateText">{{ dateText }}</span>
          <span v-if="post.sort">
            <NuxtLink
              :to="`/${lang}/post/list/sort/${post.sort.alias || post.sort._id}`"
              class="hover:underline"
            >
              {{ post.sort.sortname }}
            </NuxtLink>
          </span>
          <span
            v-if="post.type === 2"
            class="px-1.5 py-0.5 rounded bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300"
          >
            Tweet
          </span>
        </div>
      </div>
    </NuxtLink>
  </article>
</template>
