<template>
  <LazyPostDetail />
</template>
<script setup>
const { languageCode } = useLang()
languageCode.value

definePageMeta({
  name: 'pageDetail'
})
</script>
<style scoped></style>
