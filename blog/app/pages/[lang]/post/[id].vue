<template>
  <PostDetailPage />
</template>

<script setup>
import PostDetailPage from '@/components/PostDetailPage.vue'

definePageMeta({ middleware: 'validate-lang' })
</script>