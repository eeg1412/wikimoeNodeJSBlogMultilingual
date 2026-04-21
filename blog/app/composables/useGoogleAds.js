// Google AdSense 辅助：读取 site options 并生成 script 注入 / 位置启用判断。
import { useSiteOptions } from './useSiteOptions'

export function useGoogleAds() {
  const site = useSiteOptions()

  const enabled = computed(() => Boolean(site.value?.googleAdEnabled))
  const adClient = computed(() => site.value?.googleAdId || '')
  const postBottomEnabled = computed(() =>
    Boolean(
      site.value?.googleAdEnabled && site.value?.googleAdPostBottomEnabled
    )
  )
  const postBottomParams = computed(
    () => site.value?.googleAdPostBottomParams || {}
  )

  // 在 head 注入 AdSense 主脚本。只有在 enabled 且 adClient 存在时注入。
  function applyAdSenseScript() {
    const id = adClient.value
    if (!enabled.value || !id) return
    useHead({
      script: [
        {
          key: 'adsbygoogle',
          async: true,
          crossorigin: 'anonymous',
          src: `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(id)}`
        }
      ],
      meta: [{ name: 'google-adsense-account', content: id }]
    })
  }

  return {
    enabled,
    adClient,
    postBottomEnabled,
    postBottomParams,
    applyAdSenseScript
  }
}
