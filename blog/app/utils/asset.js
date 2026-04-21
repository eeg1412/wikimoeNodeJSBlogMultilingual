// 前台运行时资源路径解析：
// - /upload /content /ucloudImg /up_works /web_demo → 原站 public origin
// - /localized → 多语言站 API 域
// - http(s):// → 原样保留
// - 其它 / 开头 → 原样保留

const SOURCE_PREFIXES = [
  '/upload',
  '/content',
  '/ucloudImg',
  '/up_works',
  '/web_demo'
]

function trimTrailingSlash(s) {
  return (s || '').replace(/\/+$/, '')
}

function matchesPrefix(path, prefix) {
  return path === prefix || path.indexOf(prefix + '/') === 0
}

export function resolveAssetUrl(value, overrides) {
  if (!value || typeof value !== 'string') return value
  if (/^https?:\/\//i.test(value) || value.indexOf('//') === 0) {
    return value
  }
  if (value.charAt(0) !== '/') {
    return value
  }

  const config = useRuntimeConfig()
  const sourceOrigin = trimTrailingSlash(
    (overrides && overrides.sourceOrigin) ||
      config.public.sourceBlogPublicOrigin
  )
  const localPrefix =
    (overrides && overrides.localPrefix) ||
    config.public.localizedPublicBasePath ||
    '/localized'
  const localApiOrigin = trimTrailingSlash(
    (overrides && overrides.localApiOrigin) || config.public.apiDomain
  )

  const pathOnly = value.split('?')[0].split('#')[0]

  if (matchesPrefix(pathOnly, localPrefix)) {
    if (localApiOrigin) return localApiOrigin + value
    return value
  }

  for (let i = 0; i < SOURCE_PREFIXES.length; i++) {
    if (matchesPrefix(pathOnly, SOURCE_PREFIXES[i])) {
      if (sourceOrigin) return sourceOrigin + value
      return value
    }
  }

  return value
}

// 在正文 HTML 字符串中替换原站相对路径为最终可访问地址。
// 仅处理 src/href 属性。
export function resolveHtmlAssets(html) {
  if (!html || typeof html !== 'string') return html
  return html.replace(
    /(src|href)="(\/[^"#?]+(?:\?[^"]*)?)"/gi,
    (match, attr, value) => {
      const resolved = resolveAssetUrl(value)
      return `${attr}="${resolved}"`
    }
  )
}
