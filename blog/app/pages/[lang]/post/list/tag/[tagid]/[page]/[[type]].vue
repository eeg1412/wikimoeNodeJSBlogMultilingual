<template>
  <PostListPage
    mode="tag"
    :filter-id="String(route.params.tagid)"
    :page="route.params.page"
    :type="route.params.type"
  />
</template>

<script setup>
import PostListPage from '@/components/PostListPage.vue'

definePageMeta({ middleware: 'validate-lang' })

const route = useRoute()
</script>