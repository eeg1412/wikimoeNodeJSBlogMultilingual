<template>
  <div />
</template>

<script setup>
const runtimeConfig = useRuntimeConfig()
const { data: options } = await useAsyncData('root-options', () =>
  $fetch(`${runtimeConfig.public.apiDomain}/api/blog/options`, {
    params: { lang: 'en' }
  })
)

await navigateTo(`/${options.value?.siteDefaultLanguageCode || 'en'}`, {
  redirectCode: 302
})
</script>
