<template>
  <PostListPage mode="sort" :filter-id="String(route.params.sortid)" />
</template>

<script setup>
import PostListPage from '@/components/PostListPage.vue'

definePageMeta({ middleware: 'validate-lang' })

const route = useRoute()
</script>