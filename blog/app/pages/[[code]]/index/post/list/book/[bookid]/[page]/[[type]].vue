<template>
  <LazyPostList />
</template>
<script setup>
const { languageCode } = useLang()
languageCode.value

definePageMeta({
  name: 'postListBook'
})
</script>
<style scoped></style>
