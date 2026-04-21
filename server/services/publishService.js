const fs = require('fs-extra')
const path = require('path')
const db = require('../mongodb')
const env = require('../config/env')
const HttpError = require('../utils/httpError')
const {
  extractHtmlMediaReferences,
  extractPlainTextFromHtml,
  validateHtmlContent
} = require('../utils/html')
const { ATTACHMENT_SOURCE_TYPE, POST_STATUS, SUPPORTED_LANGUAGE_CODES, TRANSLATION_STATUS } = require('../../common/constants')

function isApprovedStatus(status) {
  return [TRANSLATION_STATUS.APPROVED, TRANSLATION_STATUS.NOT_REQUIRED].includes(status)
}

function pushTranslationError(errors, label, doc) {
  if (!doc) {
    errors.push(`${label}不存在`)
    return
  }
  if (!isApprovedStatus(doc.translationStatus)) {
    errors.push(`${label}尚未完成翻译确认`)
  }
}

async function validateAttachments(post, errors) {
  for (const attachment of post.coverImages || []) {
    pushTranslationError(errors, `附件 ${attachment.name || attachment.filename || attachment._id}`, attachment)
    if (attachment.attachmentSourceType === ATTACHMENT_SOURCE_TYPE.LOCALIZED) {
      if (attachment.languageCode !== post.languageCode) {
        errors.push('本地化附件语言与文章语言不一致')
      }
      const fileExists = await fs.pathExists(
        path.join(env.LOCAL_ATTACHMENT_STORAGE_ABS_DIR, attachment.storagePath)
      )
      if (!fileExists) {
        errors.push(`本地化附件文件缺失: ${attachment.filename}`)
      }
    }
  }
}

async function validateHtmlReferences(post, errors) {
  const content = validateHtmlContent(post.content || '')
  const mediaRefs = extractHtmlMediaReferences(content, env.SOURCE_BLOG_PUBLIC_ORIGIN)
  for (const ref of mediaRefs) {
    const value = ref.normalizedValue
    if (ref.tagName === 'a') {
      if (typeof value !== 'string' || !value) {
        errors.push('正文链接为空')
      }
      continue
    }

    if (value.startsWith(env.LOCAL_ATTACHMENT_PUBLIC_BASE_PATH)) {
      const doc = await db.utils.attachments.findOne({
        filepath: value,
        attachmentSourceType: ATTACHMENT_SOURCE_TYPE.LOCALIZED,
        languageCode: post.languageCode
      })
      if (!doc) {
        errors.push(`正文本地化资源未登记: ${value}`)
      }
      continue
    }

    if (value.startsWith('/')) {
      const doc = await db.utils.attachments.findOne({
        $or: [{ sourcePath: value }, { filepath: value }],
        attachmentSourceType: ATTACHMENT_SOURCE_TYPE.REMOTE,
        languageCode: post.languageCode
      })
      if (!doc) {
        errors.push(`正文远程资源未登记: ${value}`)
      }
      continue
    }

    if (/^https?:\/\//i.test(value)) {
      const doc = await db.utils.attachments.findOne({
        externalUrl: value,
        attachmentSourceType: ATTACHMENT_SOURCE_TYPE.REMOTE,
        languageCode: post.languageCode
      })
      if (!doc) {
        errors.push(`正文外链资源未登记: ${value}`)
      }
    }
  }
}

async function ensurePostExcerpt(post) {
  if (post.excerpt?.trim()) {
    return post.excerpt
  }

  const excerpt = extractPlainTextFromHtml(post.content || '').slice(0, 200)
  if (!excerpt) {
    return ''
  }

  post.excerpt = excerpt
  await db.utils.posts.updateOne({ _id: post._id }, { $set: { excerpt } })

  return excerpt
}

async function validatePostForPublish(postId) {
  const post = await db.utils.posts.findOne({ _id: postId }, undefined, { scope: 'detail' })
  if (!post) {
    throw new HttpError(404, '文章不存在')
  }

  const resolvedExcerpt = await ensurePostExcerpt(post)
  const errors = []
  if (![1, 2].includes(post.type)) {
    errors.push('文章类型必须为 1 或 2')
  }
  if (!SUPPORTED_LANGUAGE_CODES.includes(post.languageCode)) {
    errors.push('languageCode 非法')
  }
  if (!post.title?.trim()) {
    errors.push('标题不能为空')
  }
  if (!resolvedExcerpt) {
    errors.push('摘要不能为空')
  }
  if (!post.content?.trim()) {
    errors.push('正文不能为空')
  }
  if (!post.alias?.trim()) {
    errors.push('别名不能为空')
  }

  const aliasConflict = await db.utils.posts.findOne({
    _id: { $ne: post._id },
    alias: post.alias,
    languageCode: post.languageCode
  })
  if (aliasConflict) {
    errors.push('当前语言下 alias 已存在')
  }

  if (post.author) {
    pushTranslationError(errors, '作者', post.author)
  }
  if (post.sort) {
    pushTranslationError(errors, '分类', post.sort)
  }

  for (const tag of post.tags || []) {
    pushTranslationError(errors, `标签 ${tag.tagname || tag._id}`, tag)
  }
  for (const mappoint of post.mappointList || []) {
    pushTranslationError(errors, `地点 ${mappoint.title || mappoint._id}`, mappoint)
  }

  const relationKeys = [
    'bangumiList',
    'movieList',
    'gameList',
    'bookList',
    'eventList',
    'voteList',
    'contentBangumiList',
    'contentMovieList',
    'contentGameList',
    'contentBookList',
    'contentEventList',
    'contentVoteList'
  ]
  for (const key of relationKeys) {
    for (const item of post[key] || []) {
      pushTranslationError(errors, `${key} ${item.title || item._id}`, item)
    }
  }

  for (const relatedPost of [
    ...(post.postList || []),
    ...(post.tweetList || []),
    ...(post.contentPostList || []),
    ...(post.contentTweetList || [])
  ]) {
    if (!relatedPost) {
      errors.push('关联文章不存在')
      continue
    }
    if (relatedPost.translationStatus === TRANSLATION_STATUS.STUB) {
      errors.push(`关联文章仍为 stub: ${relatedPost.title || relatedPost.sourceId}`)
    }
  }

  await validateAttachments(post, errors)
  await validateHtmlReferences(post, errors)

  const validationState = {
    checkedAt: new Date(),
    errors,
    isValid: errors.length === 0
  }

  await db.utils.posts.updateOne({ _id: post._id }, { $set: { validationState } })

  return { post, validationState }
}

async function publishPost(postId) {
  const { post, validationState } = await validatePostForPublish(postId)
  if (!validationState.isValid) {
    throw new HttpError(400, '发布校验未通过', validationState.errors)
  }

  await db.utils.posts.updateOne(
    { _id: post._id },
    {
      $set: {
        status: POST_STATUS.PUBLISHED,
        validationState,
        'publishMeta.publishedAt': new Date()
      }
    }
  )
  global.$cacheData.public.clear()
  return db.utils.posts.findOne({ _id: post._id }, undefined, { scope: 'detail' })
}

async function unpublishPost(postId) {
  const post = await db.utils.posts.findOne({ _id: postId })
  if (!post) {
    throw new HttpError(404, '文章不存在')
  }
  await db.utils.posts.updateOne(
    { _id: post._id },
    {
      $set: {
        status: POST_STATUS.DRAFT
      }
    }
  )
  global.$cacheData.public.clear()
  return db.utils.posts.findOne({ _id: post._id }, undefined, { scope: 'detail' })
}

module.exports = {
  publishPost,
  unpublishPost,
  validatePostForPublish
}