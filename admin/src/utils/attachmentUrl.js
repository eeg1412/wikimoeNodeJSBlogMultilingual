// 运行时拼接原站资源 URL。该值由 blog options 接口注入后端环境，管理端直接读 import.meta.env 或 runtime config。
// 这里简化：接收 origin 参数。

export function resolveAttachmentUrl(attachment, sourceOrigin = '') {
  if (!attachment) return ''
  const src = attachment.attachmentSourceType
  if (src === 'localized') {
    // localized 直接就是公共路径
    return attachment.filepath || attachment.storagePath || ''
  }
  // remote
  if (attachment.externalUrl) return attachment.externalUrl
  if (attachment.sourcePath) {
    if (!sourceOrigin) return attachment.sourcePath
    const base = sourceOrigin.replace(/\/+$/, '')
    return base + attachment.sourcePath
  }
  return attachment.filepath || ''
}
