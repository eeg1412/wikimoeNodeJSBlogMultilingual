<template>
  <div class="prose prose-stone max-w-none prose-headings:font-display prose-a:text-accent-700 prose-img:rounded-2xl dark:prose-invert" v-html="resolvedHtml" />
</template>

<script setup>
import { rewriteContentHtml } from '@/utils/site'

const props = defineProps({
  content: {
    type: String,
    default: ''
  }
})

const runtimeConfig = useRuntimeConfig()
const resolvedHtml = computed(() => rewriteContentHtml(props.content, runtimeConfig))
</script>