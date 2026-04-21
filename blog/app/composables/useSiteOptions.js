export async function useSiteOptions(languageCode) {
  const runtimeConfig = useRuntimeConfig()
  const lang = computed(() => unref(languageCode) || 'en')
  const key = computed(() => `site-options:${lang.value}`)

  const { data, pending, error, refresh } = await useAsyncData(
    key.value,
    () =>
      $fetch(`${runtimeConfig.public.apiDomain}/api/blog/options`, {
        params: { lang: lang.value }
      }).then(response => response.data),
    {
      watch: [lang]
    }
  )

  const options = computed(() => data.value || {})

  return {
    error,
    options,
    pending,
    refresh
  }
}
