<template>
  <LazyPostList />
</template>
<script setup>
const { languageCode } = useLang()
languageCode.value

definePageMeta({
  name: 'postListSort'
})
</script>
<style scoped></style>
