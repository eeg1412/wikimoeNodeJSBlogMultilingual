const {
  postDetailSchema,
  postUpdateSchema
} = require('../../common/validation/postEditor')
const postsUtils = require('../mongodb/utils/posts')
const { validatePostForPublish } = require('./publishValidatorService')

function getPopulateOptions() {
  return [
    {
      path: 'author',
      select: 'nickname'
    },
    {
      path: 'sort',
      select: 'sortname'
    },
    {
      path: 'tags',
      select: 'tagname'
    },
    {
      path: 'mappointList',
      select: 'title summary'
    },
    {
      path: 'coverImages',
      select: 'filepath thumfor width height'
    }
  ]
}

function toAdminPostDetail(post) {
  return {
    _id: String(post._id),
    sourceId: post.sourceId,
    sourceAlias: post.sourceAlias,
    groupSourceId: post.groupSourceId,
    languageCode: post.languageCode,
    translationStatus: post.translationStatus,
    isManualEdited: post.isManualEdited === true,
    title: post.title || '',
    alias: post.alias || '',
    excerpt: post.excerpt || '',
    content: post.content || '',
    date: post.date,
    status: post.status,
    type: post.type,
    allowRemark: post.allowRemark === true,
    template: post.template || '',
    code: post.code || '',
    editorVersion: post.editorVersion || 5,
    author: post.author,
    sort: post.sort,
    tags: Array.isArray(post.tags) ? post.tags : [],
    mappointList: Array.isArray(post.mappointList) ? post.mappointList : [],
    coverImages: Array.isArray(post.coverImages) ? post.coverImages : [],
    importMeta: post.importMeta || null,
    publishMeta: post.publishMeta || null,
    validationState: post.validationState || null,
    updatedAt: post.updatedAt,
    createdAt: post.createdAt
  }
}

async function getPostDetail(query) {
  const validatedQuery = await postDetailSchema.validateAsync(query, {
    abortEarly: false,
    stripUnknown: true
  })
  const post = await postsUtils.findOne(
    {
      _id: validatedQuery.id
    },
    null,
    {
      populate: getPopulateOptions(),
      lean: true
    }
  )

  if (!post) {
    throw new Error('文章不存在')
  }

  return toAdminPostDetail(post)
}

async function validatePost(query) {
  const detail = await getPostDetail(query)
  return validatePostForPublish(detail)
}

async function updatePost(payload, operatorAdminId) {
  const validatedPayload = await postUpdateSchema.validateAsync(payload, {
    abortEarly: false,
    stripUnknown: true
  })
  const existingPost = await postsUtils.findOne(
    {
      _id: validatedPayload.id
    },
    null,
    {
      lean: true
    }
  )

  if (!existingPost) {
    throw new Error('文章不存在')
  }

  const nextPost = {
    ...existingPost,
    ...validatedPayload,
    alias: validatedPayload.alias.trim(),
    title: validatedPayload.title,
    excerpt: validatedPayload.excerpt,
    content: validatedPayload.content,
    template: validatedPayload.template,
    code: validatedPayload.code,
    allowRemark: validatedPayload.allowRemark,
    author: validatedPayload.author || null,
    sort: validatedPayload.sort || null,
    tags: validatedPayload.tags,
    mappointList: validatedPayload.mappointList,
    editorVersion: validatedPayload.editorVersion,
    isManualEdited: true,
    lastChangDate: new Date()
  }
  const validationState = await validatePostForPublish(nextPost)

  if (validatedPayload.status === 1 && !validationState.valid) {
    const publishError = new Error('发布校验未通过')
    publishError.statusCode = 400
    publishError.validationState = validationState
    throw publishError
  }

  const publishMeta =
    validatedPayload.status === 1
      ? {
          publishedAt: new Date(),
          publishedByAdminId: operatorAdminId,
          lastSavedAt: new Date(),
          lastSavedByAdminId: operatorAdminId
        }
      : {
          ...(existingPost.publishMeta || {}),
          lastSavedAt: new Date(),
          lastSavedByAdminId: operatorAdminId
        }

  const updatedPost = await postsUtils.findOneAndUpdate(
    {
      _id: validatedPayload.id
    },
    {
      $set: {
        title: nextPost.title,
        alias: nextPost.alias,
        excerpt: nextPost.excerpt,
        content: nextPost.content,
        date: nextPost.date,
        status: nextPost.status,
        type: nextPost.type,
        allowRemark: nextPost.allowRemark,
        author: nextPost.author,
        sort: nextPost.sort,
        tags: nextPost.tags,
        mappointList: nextPost.mappointList,
        template: nextPost.template,
        code: nextPost.code,
        editorVersion: nextPost.editorVersion,
        isManualEdited: true,
        lastChangDate: nextPost.lastChangDate,
        publishMeta,
        validationState
      }
    },
    {
      new: true,
      populate: getPopulateOptions()
    }
  )

  return toAdminPostDetail(updatedPost.toObject())
}

module.exports = {
  getPostDetail,
  updatePost,
  validatePost
}
