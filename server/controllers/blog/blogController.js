const {
  getArchive,
  getMappointDetail,
  getPostDetail,
  getPostList,
  getPublicOptions,
  getSortDetail,
  getSortList,
  getTagDetail
} = require('../../services/blog/blogQueryService')
const {
  mapPagination,
  mapPostCard,
  mapPostDetail
} = require('../../viewmodels/blog/postViewModel')

const { SUPPORTED_LANGUAGE_CODES } = require('../../../common/constants/app')

function validateLanguageCode(languageCode) {
  const normalizedLanguageCode = String(languageCode).trim().toLowerCase()

  if (!SUPPORTED_LANGUAGE_CODES.includes(normalizedLanguageCode)) {
    const error = new Error('不支持的语言')
    error.statusCode = 404
    throw error
  }

  return normalizedLanguageCode
}

async function createPageBase(languageCode) {
  const site = await getPublicOptions()

  return {
    languageCode,
    site
  }
}

async function renderHomePage(req, res, next) {
  try {
    const languageCode = validateLanguageCode(req.params.lang)
    const base = await createPageBase(languageCode)
    const listResult = await getPostList({
      languageCode,
      page: 1
    })
    const list = listResult.list.map(function (post) {
      return mapPostCard(post, base.site.sourceBlogPublicOrigin)
    })

    res.render('pages/home', {
      page: {
        lang: languageCode,
        title: base.site.title || 'wikimoeNodeJSBlogMultilingual',
        description: base.site.description || ''
      },
      site: base.site,
      list,
      pagination: mapPagination(listResult)
    })
  } catch (error) {
    next(error)
  }
}

async function renderPostListPage(req, res, next) {
  try {
    const languageCode = validateLanguageCode(req.params.lang)
    const base = await createPageBase(languageCode)
    const listResult = await getPostList({
      languageCode,
      page: req.params.page || 1,
      type: req.params.type,
      sortId: req.params.sortid,
      tagId: req.params.tagid,
      mappointId: req.params.mappointid
    })
    const list = listResult.list.map(function (post) {
      return mapPostCard(post, base.site.sourceBlogPublicOrigin)
    })

    res.render('pages/post-list', {
      page: {
        lang: languageCode,
        title: base.site.title || 'wikimoeNodeJSBlogMultilingual',
        description: base.site.description || ''
      },
      site: base.site,
      list,
      pagination: mapPagination(listResult)
    })
  } catch (error) {
    next(error)
  }
}

async function renderPostDetailPage(req, res, next) {
  try {
    const languageCode = validateLanguageCode(req.params.lang)
    const base = await createPageBase(languageCode)
    const post = await getPostDetail(languageCode, req.params.id)
    const postDetail = mapPostDetail(post, base.site.sourceBlogPublicOrigin)

    res.render('pages/post-detail', {
      page: {
        lang: languageCode,
        title: postDetail.title,
        description: postDetail.excerpt || base.site.description || ''
      },
      site: base.site,
      post: postDetail
    })
  } catch (error) {
    next(error)
  }
}

async function getOptionsApi(req, res, next) {
  try {
    const data = await getPublicOptions()
    res.json({ data })
  } catch (error) {
    next(error)
  }
}

async function getPostListApi(req, res, next) {
  try {
    const languageCode = validateLanguageCode(req.query.lang)
    const listResult = await getPostList({
      languageCode,
      page: req.query.page || 1,
      type: req.query.type,
      sortId: req.query.sortid,
      tagId: req.query.tagid,
      mappointId: req.query.mappointid
    })
    const site = await getPublicOptions()

    res.json({
      list: listResult.list.map(function (post) {
        return mapPostCard(post, site.sourceBlogPublicOrigin)
      }),
      total: listResult.total,
      page: listResult.page,
      size: listResult.limit
    })
  } catch (error) {
    next(error)
  }
}

async function getPostDetailApi(req, res, next) {
  try {
    const languageCode = validateLanguageCode(req.query.lang)
    const post = await getPostDetail(languageCode, req.query.id)
    const site = await getPublicOptions()
    res.json({
      data: mapPostDetail(post, site.sourceBlogPublicOrigin)
    })
  } catch (error) {
    next(error)
  }
}

async function getArchiveApi(req, res, next) {
  try {
    const languageCode = validateLanguageCode(req.query.lang)
    const archive = await getArchive(languageCode)
    res.json({ data: archive })
  } catch (error) {
    next(error)
  }
}

async function getSortListApi(req, res, next) {
  try {
    const languageCode = validateLanguageCode(req.query.lang)
    const list = await getSortList(languageCode)
    res.json({ data: list })
  } catch (error) {
    next(error)
  }
}

async function getSortDetailApi(req, res, next) {
  try {
    const languageCode = validateLanguageCode(req.query.lang)
    const detail = await getSortDetail(languageCode, req.query.id)
    res.json({ data: detail })
  } catch (error) {
    next(error)
  }
}

async function getTagDetailApi(req, res, next) {
  try {
    const languageCode = validateLanguageCode(req.query.lang)
    const detail = await getTagDetail(languageCode, req.query.id)
    res.json({ data: detail })
  } catch (error) {
    next(error)
  }
}

async function getMappointDetailApi(req, res, next) {
  try {
    const languageCode = validateLanguageCode(req.query.lang)
    const detail = await getMappointDetail(languageCode, req.query.id)
    res.json({ data: detail })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getArchiveApi,
  getMappointDetailApi,
  getOptionsApi,
  getPostDetailApi,
  getPostListApi,
  getSortDetailApi,
  getSortListApi,
  getTagDetailApi,
  renderHomePage,
  renderPostDetailPage,
  renderPostListPage
}
