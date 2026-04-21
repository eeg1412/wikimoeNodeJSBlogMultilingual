<script setup>
// 根路径：按 siteDefaultLanguageCode 跳到对应语言首页。
const site = await ensureSiteOptions()
const lang = site?.siteDefaultLanguageCode || 'en'
await navigateTo(`/${lang}`, { replace: true, redirectCode: 302 })
</script>

<template>
  <div class="p-8 text-center text-gray-500">Redirecting...</div>
</template>
