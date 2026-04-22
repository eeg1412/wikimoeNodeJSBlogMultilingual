import { getSystemConfig } from '../config/globalConfig.js'
import { isSourceAssetRelativePath } from './sourceUrlNormalizer.js'
import { LOCAL_ATTACHMENT_STORAGE_DIR } from '../config/env.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * 在运行时把原站相对路径资源拼接为完整可访问地址
 * @param {string} relativePath
 * @returns {string}
 */
export function resolveSourceAsset(relativePath) {
  if (!relativePath) return ''
  const systemConfig = getSystemConfig()
  const origin = systemConfig.sourceBlogPublicOrigin
  if (!origin) {
    // 未配置原站域名时，原样返回相对路径（前台可展示提示）
    return relativePath
  }
  const base = origin.replace(/\/$/, '')
  const path = relativePath.startsWith('/') ? relativePath : '/' + relativePath
  return base + path
}

/**
 * 解析附件 src 供模板直接使用
 * - localized 附件：返回多语言站本地可访问路径（/local-attachments/...）
 * - remote 且有 sourcePath：拼接原站域名
 * - remote 且有 externalUrl：直接返回
 * @param {object} attachment - Attachment mongoose document (lean)
 * @returns {string}
 */
export function resolveAttachmentSrc(attachment) {
  if (!attachment) return ''
  if (attachment.attachmentSourceType === 'localized') {
    return attachment.filepath || ''
  }
  if (
    attachment.sourcePath &&
    isSourceAssetRelativePath(attachment.sourcePath)
  ) {
    return resolveSourceAsset(attachment.sourcePath)
  }
  if (attachment.externalUrl) {
    return attachment.externalUrl
  }
  if (attachment.filepath) {
    return resolveSourceAsset(attachment.filepath)
  }
  return ''
}

/**
 * 为 EJS 模板中的正文 HTML 批量替换原站相对路径为完整 URL
 * @param {string} html
 * @returns {string}
 */
export function resolveContentHtmlAssets(html) {
  if (!html) return ''
  const systemConfig = getSystemConfig()
  const origin = systemConfig.sourceBlogPublicOrigin
  if (!origin) return html
  const base = origin.replace(/\/$/, '')

  // 替换 src="/upload/... 等原站相对路径资源
  return html.replace(
    /(src|href)="(\/(?:upload|content|ucloudImg|up_works|web_demo)\/[^"]+)"/g,
    (match, attr, path) => {
      return `${attr}="${base}${path}"`
    }
  )
}
