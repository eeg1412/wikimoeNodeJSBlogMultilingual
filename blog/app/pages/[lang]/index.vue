<template>
  <PostListPage mode="home" />
</template>

<script setup>
import PostListPage from '@/components/PostListPage.vue'

definePageMeta({ middleware: 'validate-lang' })
</script>