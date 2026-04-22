const { postListSchema } = require('../../common/validation/postList')
const postsUtils = require('../mongodb/utils/posts')

function getPopulateOptions() {
  return [
    {
      path: 'author',
      select: 'nickname'
    },
    {
      path: 'sort',
      select: 'sortname'
    }
  ]
}

function buildFilters(query) {
  const filters = {}

  if (query.languageCode) {
    filters.languageCode = query.languageCode
  }

  if (typeof query.status === 'number') {
    filters.status = query.status
  }

  if (query.keyword) {
    const escapedKeyword = query.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escapedKeyword, 'i')
    filters.$or = [
      { title: regex },
      { alias: regex },
      { excerpt: regex },
      { sourceAlias: regex }
    ]
  }

  return filters
}

function mapPostListItem(post) {
  return {
    _id: String(post._id),
    languageCode: post.languageCode,
    title: post.title || '',
    alias: post.alias || '',
    sourceAlias: post.sourceAlias || '',
    status: post.status,
    type: post.type,
    translationStatus: post.translationStatus || '',
    date: post.date,
    updatedAt: post.updatedAt,
    author: post.author,
    sort: post.sort
  }
}

async function listAdminPosts(query) {
  const validatedQuery = await postListSchema.validateAsync(query || {}, {
    abortEarly: false,
    stripUnknown: true
  })
  const result = await postsUtils.findPage(
    buildFilters(validatedQuery),
    null,
    validatedQuery.page,
    validatedQuery.size,
    {
      sort: {
        updatedAt: -1,
        _id: -1
      },
      populate: getPopulateOptions(),
      lean: true
    }
  )

  return {
    list: result.list.map(mapPostListItem),
    total: result.total,
    page: result.page,
    size: result.limit
  }
}

module.exports = {
  listAdminPosts
}
