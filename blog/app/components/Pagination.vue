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
  <nav v-if="totalPages > 1" class="pagination">
    <NuxtLink
      v-if="page > 1"
      :to="buildHref(page - 1)"
      class="pagination-item pagination-item--ghost"
    >
      上一页
    </NuxtLink>

    <template v-for="(item, idx) in pages" :key="idx">
      <span v-if="item.type === 'ellipsis'" class="pagination-ellipsis"
        >...</span
      >
      <NuxtLink
        v-else
        :to="buildHref(item.value)"
        class="pagination-item"
        :class="{ 'is-active': item.value === page }"
      >
        {{ item.value }}
      </NuxtLink>
    </template>

    <NuxtLink
      v-if="page < totalPages"
      :to="buildHref(page + 1)"
      class="pagination-item pagination-item--ghost"
    >
      下一页
    </NuxtLink>
  </nav>
</template>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}

.pagination-item {
  text-decoration: none;
  color: inherit;
  min-width: 44px;
  padding: 10px 14px;
  border-radius: 999px;
  border: 1px solid rgba(23, 32, 51, 0.12);
  background: rgba(255, 255, 255, 0.78);
  text-align: center;
  transition:
    background 0.2s ease,
    transform 0.2s ease;
}

:global(.dark) .pagination-item {
  background: rgba(17, 24, 39, 0.84);
  border-color: rgba(255, 255, 255, 0.1);
}

.pagination-item:hover,
.pagination-item.is-active {
  transform: translateY(-1px);
  background: #172033;
  color: #ffffff;
  border-color: #172033;
}

:global(.dark) .pagination-item:hover,
:global(.dark) .pagination-item.is-active {
  background: #f8fafc;
  color: #0f172a;
  border-color: #f8fafc;
}

.pagination-item--ghost {
  min-width: 88px;
}

.pagination-ellipsis {
  color: #7b879a;
}

:global(.dark) .pagination-ellipsis {
  color: #cbd5e1;
}
</style>
