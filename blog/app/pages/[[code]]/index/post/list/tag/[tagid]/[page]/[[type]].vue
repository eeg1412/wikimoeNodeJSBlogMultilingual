<template>
  <LazyPostList />
</template>
<script setup>
const { languageCode } = useLang()
languageCode.value

definePageMeta({
  name: 'postListTag'
})
</script>
<style scoped></style>
