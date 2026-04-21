<script setup>
const props = defineProps({
  page: { type: Number, required: true },
  size: { type: Number, required: true },
  total: { type: Number, required: true },
  buildHref: { type: Function, required: true }
})

const totalPages = computed(() => {
  if (!props.size) return 1
  return Math.max(1, Math.ceil(props.total / props.size))
})

const pages = computed(() => {
  const result = []
  const current = props.page
  const max = totalPages.value
  const range = 2
  const start = Math.max(1, current - range)
  const end = Math.min(max, current + range)
  if (start > 1) {
    result.push({ type: 'page', value: 1 })
    if (start > 2) result.push({ type: 'ellipsis' })
  }
  for (let i = start; i <= end; i++) {
    result.push({ type: 'page', value: i })
  }
  if (end < max) {
    if (end < max - 1) result.push({ type: 'ellipsis' })
    result.push({ type: 'page', value: max })
  }
  return result
})
</script>

<template>
  <nav
    v-if="totalPages > 1"
    class="pagination flex items-center justify-center gap-1 text-sm"
  >
    <NuxtLink
      v-if="page > 1"
      :to="buildHref(page - 1)"
      class="pagination-item px-3 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
    >
      Prev
    </NuxtLink>
    <template v-for="(item, idx) in pages" :key="idx">
      <span v-if="item.type === 'ellipsis'" class="px-2 text-gray-400"
        >...</span
      >
      <NuxtLink
        v-else
        :to="buildHref(item.value)"
        class="pagination-item px-3 py-1 rounded border border-gray-300 dark:border-gray-600"
        :class="
          item.value === page
            ? 'bg-blue-500 text-white border-blue-500'
            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
        "
      >
        {{ item.value }}
      </NuxtLink>
    </template>
    <NuxtLink
      v-if="page < totalPages"
      :to="buildHref(page + 1)"
      class="pagination-item px-3 py-1 rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
    >
      Next
    </NuxtLink>
  </nav>
</template>
