<template>
  <div>
    <LazyPostList />
  </div>
</template>
<script setup>
import { postLogCreateApi } from '@/api/log'

const { languageCode } = useLang()
languageCode.value

definePageMeta({
  name: 'postList'
})
onMounted(() => {
  postLogCreateApi({
    action: 'postList'
  })
})
</script>
<style scoped></style>
