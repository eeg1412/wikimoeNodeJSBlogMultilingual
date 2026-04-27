<template>
  <LazyPostList />
</template>
<script setup>
const { languageCode } = useLang()
languageCode.value

definePageMeta({
  name: 'postListMovie'
})
</script>
<style scoped></style>
