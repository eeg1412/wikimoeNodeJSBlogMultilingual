const SUPPORTED_LANGUAGE_CODES = Object.freeze(['en', 'jp', 'tw'])
const POST_TYPE = Object.freeze({
  POST: 1,
  TWEET: 2,
  PAGE: 3
})
const POST_TYPE_WHITELIST = Object.freeze([POST_TYPE.POST, POST_TYPE.TWEET])
const TRANSLATION_STATUS = Object.freeze([
  'pending',
  'ai_draft',
  'manual_draft',
  'approved',
  'not_required',
  'stub',
  'outdated'
])
const SOURCE_RESOURCE_PREFIXES = Object.freeze([
  '/upload',
  '/content',
  '/ucloudImg',
  '/up_works',
  '/web_demo'
])
const DISABLED_FRONTEND_FEATURES = Object.freeze([
  'comment',
  'like',
  'share',
  'vote-submit',
  'view-report',
  'language-switcher'
])
const ADMIN_BASE_PATH = '/multilingual-admin'

module.exports = {
  ADMIN_BASE_PATH,
  DISABLED_FRONTEND_FEATURES,
  POST_TYPE,
  POST_TYPE_WHITELIST,
  SOURCE_RESOURCE_PREFIXES,
  SUPPORTED_LANGUAGE_CODES,
  TRANSLATION_STATUS
}
