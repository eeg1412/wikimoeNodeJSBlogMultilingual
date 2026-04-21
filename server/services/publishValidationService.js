const mongoose = require('mongoose')
const cheerio = require('cheerio')
const { Posts, Attachments } = require('../mongodb/models')
const {
  TRANSLATION_STATUS,
  PUBLISHABLE_TRANSLATION_STATUSES,
  IMPORTABLE_POST_TYPES,
  POST_TYPE_BLOG,
  POST_TYPE_TWEET,
  POST_STATUS_PUBLISHED,
  POST_STATUS_DRAFT,
  SUPPORTED_LANGUAGE_CODES
} = require('@wikimoe-ml/common/constants')
const { sha256Hex } = require('@wikimoe-ml/common/utils')
const {
  isSourceRelativePath
} = require('@wikimoe-ml/common/utils/sourceUrlNormalizer')
const { conflict } = require('../utils/errors')
const cacheManager = require('../utils/cache')

/**
 * 对一条 post 文档执行发布前校验，返回 issues 数组。
 * 不修改数据库；由调用方决定是否写 validationState 或阻止发布。
 *
 * issue 结构：{ level: 'error'|'warn', code, message, meta?: {...} }
 */
async function validatePostForPublish(postId) {
  if (!mongoose.isValidObjectId(postId)) {
    return {
      passed: false,
      issues: [{ level: 'error', code: 'BAD_ID', message: '文章 ID 非法' }]
    }
  }
  const post = await Posts.findById(postId)
    .populate('author')
    .populate('sort')
    .populate('tags')
    .populate('mappointList')
    .populate('coverImages')
    .populate('bangumiList movieList gameList bookList eventList voteList')
    .populate(
      'contentBangumiList contentMovieList contentGameList contentBookList contentEventList contentVoteList'
    )
    .populate({
      path: 'postList',
      select: '_id title status languageCode translationStatus'
    })
    .populate({
      path: 'tweetList',
      select: '_id title status languageCode translationStatus'
    })
    .populate({
      path: 'contentPostList',
      select: '_id title status languageCode translationStatus'
    })
    .populate({
      path: 'contentTweetList',
      select: '_id title status languageCode translationStatus'
    })
    .lean()

  const issues = []
  if (!post) {
    issues.push({ level: 'error', code: 'NOT_FOUND', message: '文章不存在' })
    return { passed: false, issues }
  }

  // type / languageCode
  if (!IMPORTABLE_POST_TYPES.includes(post.type)) {
    issues.push({
      level: 'error',
      code: 'BAD_TYPE',
      message: `type=${post.type} 不在允许发布的白名单中`
    })
  }
  if (!SUPPORTED_LANGUAGE_CODES.includes(post.languageCode)) {
    issues.push({
      level: 'error',
      code: 'BAD_LANGUAGE',
      message: `languageCode=${post.languageCode} 不在允许发布的语言中`
    })
  }

  // 基础字段
  if (!post.title || !post.title.trim()) {
    issues.push({ level: 'error', code: 'EMPTY_TITLE', message: '标题为空' })
  }
  if (post.type === POST_TYPE_BLOG) {
    if (!post.excerpt || !post.excerpt.trim()) {
      issues.push({
        level: 'warn',
        code: 'EMPTY_EXCERPT',
        message: '博文摘要为空，建议填写'
      })
    }
    if (!post.content || !post.content.trim()) {
      issues.push({
        level: 'error',
        code: 'EMPTY_CONTENT',
        message: '博文正文为空'
      })
    }
  }
  if (post.type === POST_TYPE_TWEET) {
    if (!post.content || !post.content.trim()) {
      issues.push({
        level: 'error',
        code: 'EMPTY_CONTENT',
        message: '推文正文为空'
      })
    }
  }

  // alias 必填且在当前语言下唯一
  if (!post.alias || !String(post.alias).trim()) {
    issues.push({
      level: 'error',
      code: 'EMPTY_ALIAS',
      message: 'alias 不能为空'
    })
  } else {
    const dup = await Posts.findOne({
      _id: { $ne: post._id },
      languageCode: post.languageCode,
      alias: post.alias
    })
      .select('_id')
      .lean()
    if (dup) {
      issues.push({
        level: 'error',
        code: 'DUPLICATE_ALIAS',
        message: `alias 在语言 ${post.languageCode} 下已被其他文章占用`,
        meta: { conflictPostId: String(dup._id) }
      })
    }
  }

  // 自身翻译状态
  if (!PUBLISHABLE_TRANSLATION_STATUSES.includes(post.translationStatus)) {
    issues.push({
      level: 'error',
      code: 'TRANSLATION_NOT_APPROVED',
      message: `当前 translationStatus=${post.translationStatus}，需要 approved 或 not_required`
    })
  }

  // 共享实体：必需 approved；pending/ai_draft/manual_draft 视为 error
  // outdated 视为 warn（已确认策略：不阻止发布，仅提醒）
  const sharedFieldMap = [
    { key: 'author', label: '作者', required: false },
    { key: 'sort', label: '分类', required: false },
    { key: 'tags', label: '标签', array: true },
    { key: 'mappointList', label: '地点', array: true },
    { key: 'coverImages', label: '封面图', array: true },
    { key: 'bangumiList', label: '推荐番剧', array: true },
    { key: 'movieList', label: '推荐电影', array: true },
    { key: 'gameList', label: '推荐游戏', array: true },
    { key: 'bookList', label: '推荐书籍', array: true },
    { key: 'eventList', label: '推荐活动', array: true },
    { key: 'voteList', label: '推荐投票', array: true },
    { key: 'contentBangumiList', label: '正文番剧', array: true },
    { key: 'contentMovieList', label: '正文电影', array: true },
    { key: 'contentGameList', label: '正文游戏', array: true },
    { key: 'contentBookList', label: '正文书籍', array: true },
    { key: 'contentEventList', label: '正文活动', array: true },
    { key: 'contentVoteList', label: '正文投票', array: true }
  ]
  for (const def of sharedFieldMap) {
    const v = post[def.key]
    if (def.array) {
      if (!Array.isArray(v)) continue
      v.forEach((item, i) =>
        collectSharedIssue(item, issues, `${def.label}[${i}]`, def.key)
      )
    } else if (v && typeof v === 'object') {
      collectSharedIssue(v, issues, def.label, def.key)
    }
  }

  // 关联文章：stub 允许但前台跳过；pending/ai_draft/manual_draft warn
  const postRefFieldMap = [
    { key: 'postList', label: '推荐文章' },
    { key: 'tweetList', label: '推荐推文' },
    { key: 'contentPostList', label: '正文文章' },
    { key: 'contentTweetList', label: '正文推文' }
  ]
  for (const def of postRefFieldMap) {
    const v = post[def.key]
    if (!Array.isArray(v)) continue
    v.forEach((item, i) => {
      if (!item) return
      if (item.translationStatus === TRANSLATION_STATUS.STUB) {
        issues.push({
          level: 'warn',
          code: 'REFERENCED_POST_STUB',
          message: `${def.label}[${i}] 仅为 stub，前台将跳过渲染`,
          meta: { field: def.key, refId: String(item._id) }
        })
      } else if (
        !PUBLISHABLE_TRANSLATION_STATUSES.includes(item.translationStatus)
      ) {
        issues.push({
          level: 'warn',
          code: 'REFERENCED_POST_NOT_APPROVED',
          message: `${def.label}[${i}] translationStatus=${item.translationStatus}`,
          meta: { field: def.key, refId: String(item._id) }
        })
      }
    })
  }

  // 正文里 <img>/<video>/<audio> 资源是否都在 attachments 登记
  if (post.content) {
    const refIssues = await validateContentMediaRegistered(
      post.content,
      post.languageCode
    )
    issues.push(...refIssues)
  }

  const passed = issues.every(i => i.level !== 'error')
  return { passed, issues }
}

function collectSharedIssue(entity, issues, label, field) {
  if (!entity) return
  const ts = entity.translationStatus
  if (ts === TRANSLATION_STATUS.OUTDATED) {
    issues.push({
      level: 'warn',
      code: 'SHARED_ENTITY_OUTDATED',
      message: `${label} 已被标记 outdated，建议人工复核`,
      meta: { field, refId: String(entity._id) }
    })
  } else if (!PUBLISHABLE_TRANSLATION_STATUSES.includes(ts)) {
    issues.push({
      level: 'error',
      code: 'SHARED_ENTITY_NOT_APPROVED',
      message: `${label} translationStatus=${ts}，需先完成翻译审核`,
      meta: { field, refId: String(entity._id) }
    })
  }
}

async function validateContentMediaRegistered(html, languageCode) {
  const issues = []
  let $
  try {
    $ = cheerio.load(html, { decodeEntities: false })
  } catch (err) {
    issues.push({
      level: 'error',
      code: 'CONTENT_HTML_PARSE_ERROR',
      message: '正文 HTML 解析失败',
      meta: { error: err.message }
    })
    return issues
  }

  const sources = []
  $('img[src], video[src], audio[src], source[src]').each((_, el) => {
    const src = $(el).attr('src')
    if (src) sources.push(src)
  })
  $('img[srcset]').each((_, el) => {
    const srcset = $(el).attr('srcset') || ''
    srcset.split(',').forEach(part => {
      const url = part.trim().split(/\s+/)[0]
      if (url) sources.push(url)
    })
  })

  const unique = Array.from(new Set(sources))
  const missing = []
  for (const src of unique) {
    const hit = await lookupAttachmentByUrl(src, languageCode)
    if (!hit) missing.push(src)
  }
  if (missing.length) {
    issues.push({
      level: 'warn',
      code: 'CONTENT_MEDIA_NOT_REGISTERED',
      message: `正文存在未登记的媒体资源 ${missing.length} 项`,
      meta: { urls: missing.slice(0, 20) }
    })
  }
  return issues
}

async function lookupAttachmentByUrl(rawUrl, languageCode) {
  if (!rawUrl) return null
  const trimmed = rawUrl.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed) || trimmed.indexOf('//') === 0) {
    const hash = sha256Hex(trimmed.replace(/^\/\//, 'http://'))
    return Attachments.findOne({
      externalUrlHash: hash,
      languageCode
    }).lean()
  }
  if (trimmed.charAt(0) === '/') {
    const pathOnly = trimmed.split('?')[0].split('#')[0]
    if (isSourceRelativePath(pathOnly)) {
      const hash = sha256Hex(trimmed)
      const direct = await Attachments.findOne({
        sourcePathHash: hash,
        languageCode
      }).lean()
      if (direct) return direct
      // 也允许 localized 的 filepath 命中（未来派生场景）
      return Attachments.findOne({ filepath: trimmed, languageCode }).lean()
    }
    // 本地 localized
    return Attachments.findOne({ filepath: trimmed, languageCode }).lean()
  }
  return null
}

/**
 * 执行发布：先校验，若 passed=true 则翻 status=1，写 publishMeta
 */
async function publishPost(postId, operatorAdminId) {
  const result = await validatePostForPublish(postId)
  // 无论通过与否都缓存最新校验结果
  await Posts.updateOne(
    { _id: postId },
    {
      $set: {
        'validationState.passed': result.passed,
        'validationState.checkedAt': new Date(),
        'validationState.issues': result.issues
      }
    }
  )
  if (!result.passed) {
    throw conflict('发布校验未通过', { issues: result.issues })
  }
  const now = new Date()
  await Posts.updateOne(
    { _id: postId },
    {
      $set: {
        status: POST_STATUS_PUBLISHED,
        'publishMeta.publishedAt': now,
        'publishMeta.lastPublishedBy': operatorAdminId || null
      }
    }
  )
  const refreshed = await Posts.findById(postId).select('languageCode').lean()
  if (refreshed && refreshed.languageCode) {
    cacheManager.invalidateLanguage(refreshed.languageCode)
  }
  cacheManager.invalidateSeo()
  return { _id: postId, publishedAt: now, issues: result.issues }
}

/**
 * 撤回发布：status=0，保留正文/关联；刷新缓存。
 */
async function unpublishPost(postId) {
  const post = await Posts.findById(postId).select('languageCode status').lean()
  if (!post) return null
  await Posts.updateOne(
    { _id: postId },
    { $set: { status: POST_STATUS_DRAFT } }
  )
  if (post.languageCode) {
    cacheManager.invalidateLanguage(post.languageCode)
  }
  cacheManager.invalidateSeo()
  return { _id: postId, status: POST_STATUS_DRAFT }
}

module.exports = {
  validatePostForPublish,
  publishPost,
  unpublishPost
}
