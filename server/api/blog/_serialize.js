const env = require('../../config/env')
const {
  resolveAssetUrl
} = require('@wikimoe-ml/common/utils/sourceAssetResolver')

// 前台统一用于运行时拼接资源路径。
function resolveForPublic(pathLike) {
  return resolveAssetUrl(pathLike, {
    sourceBlogPublicOrigin: env.SOURCE_BLOG_PUBLIC_ORIGIN,
    localizedPublicBasePath: env.LOCAL_ATTACHMENT_PUBLIC_BASE_PATH
  })
}

// 把 attachment lean 文档映射成前端可直接用的对象
function serializeAttachment(att) {
  if (!att) return null
  const filepath = att.filepath || att.sourcePath || att.externalUrl || ''
  return {
    _id: att._id,
    attachmentSourceType: att.attachmentSourceType,
    filename: att.filename,
    name: att.name,
    description: att.description,
    mimetype: att.mimetype,
    width: att.width,
    height: att.height,
    thumfor: att.thumfor,
    thumWidth: att.thumWidth,
    thumHeight: att.thumHeight,
    is360Panorama: att.is360Panorama,
    url: resolveForPublic(filepath),
    rawPath: filepath
  }
}

function serializeAttachmentList(list) {
  if (!Array.isArray(list)) return []
  const result = []
  for (let i = 0; i < list.length; i++) {
    const item = serializeAttachment(list[i])
    if (item) result.push(item)
  }
  return result
}

module.exports = {
  resolveForPublic,
  serializeAttachment,
  serializeAttachmentList
}
