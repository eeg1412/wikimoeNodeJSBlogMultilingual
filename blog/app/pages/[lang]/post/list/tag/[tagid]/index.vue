<template>
  <PostListPage mode="tag" :filter-id="String(route.params.tagid)" />
</template>

<script setup>
import PostListPage from '@/components/PostListPage.vue'

definePageMeta({ middleware: 'validate-lang' })

const route = useRoute()
</script>