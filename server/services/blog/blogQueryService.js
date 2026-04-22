const { isValidObjectId } = require('mongoose')

const {
  getSiteSettingValue,
  getSystemSettingValue
} = require('../settingsService')
const postsUtils = require('../../mongodb/utils/posts')
const sortsUtils = require('../../mongodb/utils/sorts')
const tagsUtils = require('../../mongodb/utils/tags')
const mappointsUtils = require('../../mongodb/utils/mappoints')

function createPublishedFilter(languageCode) {
  return {
    languageCode,
    status: 1
  }
}

function getPostPopulateOptions() {
  return [
    {
      path: 'author',
      select: 'nickname description photoAttachment coverAttachment'
    },
    {
      path: 'sort',
      select: 'sortname alias description'
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
      select:
        'filepath thumfor width height thumWidth thumHeight mimetype attachmentSourceType sourcePath externalUrl languageCode'
    },
    {
      path: 'bangumiList movieList gameList bookList eventList voteList contentBangumiList contentMovieList contentGameList contentBookList contentEventList contentVoteList',
      select: 'title summary description payload options'
    }
  ]
}

async function requirePageSize() {
  const pageSize = await getSiteSettingValue('pageSize', 10)

  return Number(pageSize)
}

function normalizePage(page) {
  const pageNumber = Number(page)

  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new Error('page 参数错误')
  }

  return pageNumber
}

function normalizeType(type) {
  if (typeof type === 'undefined' || type === null || type === '') {
    return null
  }

  const typeNumber = Number(type)

  if (typeNumber !== 1 && typeNumber !== 2) {
    throw new Error('type 参数错误')
  }

  return typeNumber
}

function buildPostListFilters(params) {
  const filters = createPublishedFilter(params.languageCode)
  const type = normalizeType(params.type)

  if (type) {
    filters.type = type
  } else {
    filters.type = { $in: [1, 2] }
  }

  if (params.sortId) {
    filters.sort = params.sortId
  }

  if (params.tagId) {
    filters.tags = params.tagId
  }

  if (params.mappointId) {
    filters.mappointList = params.mappointId
  }

  return filters
}

async function getPostList(params) {
  const page = normalizePage(params.page || 1)
  const pageSize = await requirePageSize()
  const filters = buildPostListFilters(params)

  return postsUtils.findPage(filters, null, page, pageSize, {
    sort: {
      date: -1,
      _id: -1
    },
    populate: getPostPopulateOptions(),
    lean: true
  })
}

async function getPostDetail(languageCode, id) {
  const baseFilters = createPublishedFilter(languageCode)
  let post = await postsUtils.findOne(
    {
      ...baseFilters,
      alias: id
    },
    null,
    {
      populate: getPostPopulateOptions(),
      lean: true
    }
  )

  if (!post && isValidObjectId(id)) {
    post = await postsUtils.findOne(
      {
        ...baseFilters,
        _id: id
      },
      null,
      {
        populate: getPostPopulateOptions(),
        lean: true
      }
    )
  }

  if (!post) {
    throw new Error('文章不存在')
  }

  return post
}

async function getSortList(languageCode) {
  return sortsUtils.find(
    {
      languageCode,
      translationStatus: {
        $in: [
          'approved',
          'not_required',
          'pending',
          'outdated',
          'manual_draft',
          'ai_draft'
        ]
      }
    },
    null,
    {
      sort: {
        taxis: 1,
        _id: 1
      },
      lean: true
    }
  )
}

async function getSortDetail(languageCode, id) {
  const sort = await sortsUtils.findOne(
    {
      languageCode,
      _id: id
    },
    null,
    { lean: true }
  )

  if (!sort) {
    throw new Error('分类不存在')
  }

  return sort
}

async function getTagDetail(languageCode, id) {
  const tag = await tagsUtils.findOne(
    {
      languageCode,
      _id: id
    },
    null,
    { lean: true }
  )

  if (!tag) {
    throw new Error('标签不存在')
  }

  return tag
}

async function getMappointDetail(languageCode, id) {
  const mappoint = await mappointsUtils.findOne(
    {
      languageCode,
      _id: id
    },
    null,
    { lean: true }
  )

  if (!mappoint) {
    throw new Error('地点不存在')
  }

  return mappoint
}

async function getArchive(languageCode) {
  const allPosts = await postsUtils.find(
    {
      languageCode,
      status: 1,
      type: {
        $in: [1, 2]
      }
    },
    'date type title alias',
    {
      sort: {
        date: -1,
        _id: -1
      },
      lean: true
    }
  )
  const archiveMap = new Map()

  for (const post of allPosts) {
    const date = post.date ? new Date(post.date) : new Date()
    const year = String(date.getUTCFullYear())
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const key = `${year}-${month}`

    if (!archiveMap.has(key)) {
      archiveMap.set(key, [])
    }

    archiveMap.get(key).push(post)
  }

  return Array.from(archiveMap.entries()).map(function ([key, posts]) {
    return {
      key,
      list: posts
    }
  })
}

async function getPublicOptions() {
  const title = await getSiteSettingValue('title', null)
  const subTitle = await getSiteSettingValue('subTitle', null)
  const description = await getSiteSettingValue('description', null)
  const keywords = await getSiteSettingValue('keywords', null)
  const url = await getSiteSettingValue('url', null)
  const favicon = await getSiteSettingValue('favicon', null)
  const footerInfo = await getSiteSettingValue('footerInfo', null)
  const themeMode = await getSiteSettingValue('themeMode', null)
  const allowSwitchTheme = await getSiteSettingValue('allowSwitchTheme', false)
  const pageSize = await getSiteSettingValue('pageSize', 10)
  const defaultLanguageCode = await getSiteSettingValue(
    'defaultLanguageCode',
    'en'
  )
  const sourceBlogPublicOrigin = await getSystemSettingValue(
    'sourceBlogPublicOrigin',
    null
  )

  return {
    title,
    subTitle,
    description,
    keywords,
    url,
    favicon,
    footerInfo,
    themeMode,
    allowSwitchTheme,
    pageSize,
    defaultLanguageCode,
    sourceBlogPublicOrigin
  }
}

module.exports = {
  getArchive,
  getMappointDetail,
  getPostDetail,
  getPostList,
  getPublicOptions,
  getSortDetail,
  getSortList,
  getTagDetail
}
