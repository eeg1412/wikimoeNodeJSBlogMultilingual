/**
 * 多语言站全局常量
 * 这些值固定写在代码中，不允许通过 env 或数据库覆盖
 */

/** 支持的语言枚举 */
export const SUPPORTED_LANGUAGES = ['en', 'jp', 'tw']

/** 允许导入的文章类型（博文=1，推文=2） */
export const ALLOWED_POST_TYPES = [1, 2]

/** 禁止导入的文章类型（页面=3） */
export const FORBIDDEN_POST_TYPE_PAGE = 3

/** 后台根路径 */
export const ADMIN_BASE_PATH = '/multilingual-admin'

/** 翻译状态枚举 */
export const TRANSLATION_STATUS = {
  PENDING: 'pending',
  AI_DRAFT: 'ai_draft',
  MANUAL_DRAFT: 'manual_draft',
  APPROVED: 'approved',
  NOT_REQUIRED: 'not_required',
  STUB: 'stub',
  OUTDATED: 'outdated'
}

/** 翻译状态：发布通过的集合 */
export const TRANSLATION_STATUS_PUBLISH_OK = [
  TRANSLATION_STATUS.APPROVED,
  TRANSLATION_STATUS.NOT_REQUIRED
]

/** 附件来源类型 */
export const ATTACHMENT_SOURCE_TYPE = {
  REMOTE: 'remote',
  LOCALIZED: 'localized'
}

/** 附件导入来源 */
export const ATTACHMENT_IMPORT_ORIGIN = {
  SOURCE_ATTACHMENT: 'sourceAttachment',
  HTML_DISCOVERED: 'htmlDiscovered',
  LOCALIZED_UPLOAD: 'localizedUpload',
  LOCALIZED_DERIVED: 'localizedDerived'
}

/** 原站内部资源相对路径前缀白名单 */
export const SOURCE_ASSET_PATH_PREFIXES = [
  '/upload',
  '/content',
  '/ucloudImg',
  '/up_works',
  '/web_demo'
]

/** 翻译站附件上传 MIME 白名单 */
export const LOCALIZED_UPLOAD_MIME_WHITELIST = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/avif',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm'
]

/** 翻译站附件上传扩展名白名单 */
export const LOCALIZED_UPLOAD_EXT_WHITELIST = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.svg',
  '.avif',
  '.mp4',
  '.webm',
  '.mp3',
  '.ogg',
  '.wav'
]

/** 翻译站附件最大上传大小（字节）= 50MB */
export const LOCALIZED_UPLOAD_MAX_SIZE = 50 * 1024 * 1024

/** 富文本禁止标签列表 */
export const RICH_TEXT_DISALLOWED_TAGS = [
  'script',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'textarea',
  'select',
  'iframe',
  'meta',
  'link',
  'style',
  'base',
  'applet'
]

/** 危险 URL 协议 */
export const DANGEROUS_URL_PROTOCOLS = [
  'javascript:',
  'vbscript:',
  'data:text/html',
  'data:application'
]

/** 导入任务状态 */
export const IMPORT_JOB_STATUS = {
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
}

/** 导入任务阶段 */
export const IMPORT_JOB_STAGE = {
  RESOLVE_SOURCE: 'resolveSource',
  EXTRACT_DEPENDENCIES: 'extractDependencies',
  UPSERT_SHARED_ENTITIES: 'upsertSharedEntities',
  UPSERT_POST: 'upsertPost',
  FINALIZE: 'finalize'
}

/** 文章发布状态 */
export const POST_STATUS = {
  DRAFT: 0,
  PUBLISHED: 1,
  TRASH: 99
}

/** 前台关闭的功能（不渲染） */
export const FRONTEND_DISABLED_FEATURES = [
  'comment',
  'like',
  'share',
  'voteSubmit',
  'viewCount',
  'languageSwitcher'
]

/** AI 翻译提供商 */
export const AI_PROVIDER = 'google-genai'

/** 翻译记忆字段类型枚举 */
export const FIELD_KIND = {
  TITLE: 'title',
  EXCERPT: 'excerpt',
  CONTENT_HTML: 'content_html',
  TEXT_FIELD: 'text_field',
  DESCRIPTION: 'description'
}
