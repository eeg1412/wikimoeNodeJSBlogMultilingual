// 统一 SEO meta 注入：canonical + hreflang alternate
// 传入 options：
//   - path：当前页的完整绝对路径（以 / 开头），例如 /en/post/foo
//   - alternates：[{ languageCode, path }]，可选，通常从 post detail 返回的 alternates 映射而来
//   - title / description / keywords：可选，覆盖站点默认

function trimTrailingSlash(s) {
  return (s || '').replace(/\/+$/, '')
}

export function useBlogSeo(options) {
  const site = useSiteOptions().value || {}
  const config = useRuntimeConfig()
  const origin = trimTrailingSlash(
    site.siteUrl || config.public.siteOrigin || ''
  )

  const path = options?.path || '/'
  const canonical = origin ? origin + path : path

  const link = []
  link.push({ rel: 'canonical', href: canonical })

  if (Array.isArray(options?.alternates)) {
    for (let i = 0; i < options.alternates.length; i++) {
      const alt = options.alternates[i]
      if (!alt || !alt.languageCode || !alt.path) continue
      link.push({
        rel: 'alternate',
        hreflang: alt.languageCode,
        href: origin ? origin + alt.path : alt.path
      })
    }
    // 默认 x-default 回到当前页
    link.push({ rel: 'alternate', hreflang: 'x-default', href: canonical })
  }

  const meta = []
  const title = options?.title || site.siteTitle || ''
  const description = options?.description || site.siteDescription || ''
  const keywords = options?.keywords || site.siteKeywords || ''
  if (description) {
    meta.push({ name: 'description', content: description })
    meta.push({ property: 'og:description', content: description })
  }
  if (keywords) {
    meta.push({ name: 'keywords', content: keywords })
  }
  if (title) {
    meta.push({ property: 'og:title', content: title })
  }
  meta.push({ property: 'og:type', content: options?.ogType || 'website' })
  meta.push({ property: 'og:url', content: canonical })

  useHead({
    title: title || undefined,
    htmlAttrs: options?.lang ? { lang: htmlLangForCode(options.lang) } : {},
    link,
    meta
  })
}

function htmlLangForCode(code) {
  switch (code) {
    case 'en':
      return 'en'
    case 'jp':
      return 'ja'
    case 'tw':
      return 'zh-Hant'
    default:
      return code
  }
}
