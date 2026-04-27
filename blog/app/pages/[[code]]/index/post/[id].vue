<template>
  <LazyPostDetail />
</template>
<script setup>
const { languageCode } = useLang()
languageCode.value

definePageMeta({
  name: 'postDetail'
})
</script>
<style scoped></style>
