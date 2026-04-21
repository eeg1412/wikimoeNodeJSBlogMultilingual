<template>
  <div />
</template>

<script setup>
const runtimeConfig = useRuntimeConfig()
const { data: options } = await useAsyncData('root-options', () =>
  $fetch(`${runtimeConfig.public.apiDomain}/api/blog/options`, {
    params: { lang: 'en' }
  }).then(response => response.data)
)

await navigateTo(`/${options.value?.siteDefaultLanguageCode || 'en'}`, {
  redirectCode: 302
})
</script>
