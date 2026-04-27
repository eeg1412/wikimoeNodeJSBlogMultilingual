<template>
  <div>
    <LazyBanner />
    <NuxtPage></NuxtPage>
  </div>
</template>
<script setup>
const { languageCode } = useLang()
languageCode.value
</script>
