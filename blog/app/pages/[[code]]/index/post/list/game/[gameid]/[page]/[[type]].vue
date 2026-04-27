<template>
  <LazyPostList />
</template>
<script setup>
const { languageCode } = useLang()
languageCode.value

definePageMeta({
  name: 'postListGame'
})
</script>
<style scoped></style>
