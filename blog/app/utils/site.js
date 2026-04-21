export const SUPPORTED_LANGUAGE_CODES = ['en', 'jp', 'tw']

export function ensureSupportedLanguage(languageCode) {
  return SUPPORTED_LANGUAGE_CODES.includes(String(languageCode))
}

export function formatDate(date) {
  if (!date) {
    return '-'
  }
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(date))
}

export function resolveAttachmentUrl(attachment, runtimeConfig) {
  if (!attachment) {
    return ''
  }
  if (attachment.resolvedUrl) {
    return attachment.resolvedUrl
  }
  if (attachment.externalUrl) {
    return attachment.externalUrl
  }
  if (attachment.sourcePath) {
    return `${runtimeConfig.public.sourceBlogPublicOrigin.replace(/\/$/, '')}${attachment.sourcePath}`
  }
  return attachment.filepath || ''
}

export function rewriteContentHtml(content, runtimeConfig) {
  if (!content) {
    return ''
  }

  const origin = runtimeConfig.public.sourceBlogPublicOrigin.replace(/\/$/, '')

  return String(content).replace(
    /(src|href)="(\/[^"#?]+(?:[^\"]*)?)"/g,
    (full, attribute, url) => {
      if (url.startsWith(runtimeConfig.public.localizedPublicBasePath)) {
        return `${attribute}="${url}"`
      }
      return `${attribute}="${origin}${url}"`
    }
  )
}

export function getEntityLabel(item) {
  if (!item) {
    return ''
  }
  return (
    item.title ||
    item.sortname ||
    item.tagname ||
    item.nickname ||
    item.name ||
    item.alias ||
    item.sourceId ||
    ''
  )
}