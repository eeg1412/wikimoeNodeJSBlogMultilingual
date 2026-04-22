/**
 * 博客端 Query Service
 */
import {
  queryPostList,
  queryPostDetail,
  querySortList,
  queryTagDetail,
  queryMappointDetail,
  queryHreflangAlternates
} from '../controllers/queryService.js'
import {
  mapPostToViewModel,
  mapPostDetailToViewModel
} from '../viewmodels/postViewModel.js'
import { getSiteConfig } from '../config/globalConfig.js'
import { cacheData } from '../config/cacheData.js'

function cacheGet(key) {
  return cacheData.get(key)
}
function cacheSet(key, val) {
  cacheData.set(key, val)
}

/**
 * 获取当前语言的站点名称，回退到通用站点名称
 * @param {object} siteConfig
 * @param {string} lang
 * @returns {string}
 */
function getSiteNameByLang(siteConfig, lang) {
  const langCapMap = { en: 'En', jp: 'Jp', tw: 'Tw' }
  const suffix = langCapMap[lang]
  if (suffix && siteConfig[`siteName${suffix}`]) {
    return siteConfig[`siteName${suffix}`]
  }
  return siteConfig.siteName || ''
}

/**
 * 获取当前语言的站点描述，回退到通用描述
 * @param {object} siteConfig
 * @param {string} lang
 * @returns {string}
 */
function getSiteDescriptionByLang(siteConfig, lang) {
  const langCapMap = { en: 'En', jp: 'Jp', tw: 'Tw' }
  const suffix = langCapMap[lang]
  if (suffix && siteConfig[`description${suffix}`]) {
    return siteConfig[`description${suffix}`]
  }
  return siteConfig.description || ''
}

function render404(res, lang, siteConfig) {
  return res
    .status(404)
    .render('pages/404', { lang, siteConfig, layout: false })
}

/**
 * 首页（/:lang）
 */
export async function homeController(req, res, next) {
  try {
    const { lang } = req.params
    const siteConfig = getSiteConfig()
    const limit = parseInt(siteConfig.pageSize) || 10

    const cacheKey = `page:home:${lang}:1`
    let cached = cacheGet(cacheKey)
    if (cached) {
      return res.render('pages/home', cached)
    }

    const { list, total } = await queryPostList({
      languageCode: lang,
      page: 1,
      limit
    })
    const sortList = await querySortList(lang)

    const vm = {
      lang,
      posts: list.map(mapPostToViewModel),
      sortList,
      total,
      page: 1,
      limit,
      totalPages: Math.ceil(total / limit),
      siteConfig,
      siteTitle: getSiteNameByLang(siteConfig, lang),
      pageTitle: getSiteNameByLang(siteConfig, lang),
      metaDescription: getSiteDescriptionByLang(siteConfig, lang)
    }

    cacheSet(cacheKey, vm, 300)
    return res.render('pages/home', vm)
  } catch (err) {
    next(err)
  }
}

/**
 * 文章列表（/:lang/post/list、/:lang/post/list/:page/:type?）
 */
export async function postListController(req, res, next) {
  try {
    const { lang } = req.params
    const page = Math.max(
      parseInt(req.params.page) || parseInt(req.query.page) || 1,
      1
    )
    const type = req.params.type || req.query.type || null
    const siteConfig = getSiteConfig()
    const limit = parseInt(siteConfig.pageSize) || 10

    const cacheKey = `page:post-list:${lang}:${page}:${type || 'all'}`
    let cached = cacheGet(cacheKey)
    if (cached) return res.render('pages/post-list', cached)

    const { list, total } = await queryPostList({
      languageCode: lang,
      page,
      limit,
      type
    })
    const sortList = await querySortList(lang)

    const vm = {
      lang,
      posts: list.map(mapPostToViewModel),
      sortList,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      filterType: type,
      siteConfig,
      siteTitle: getSiteNameByLang(siteConfig, lang),
      pageTitle: getSiteNameByLang(siteConfig, lang),
      metaDescription: getSiteDescriptionByLang(siteConfig, lang)
    }

    cacheSet(cacheKey, vm, 300)
    return res.render('pages/post-list', vm)
  } catch (err) {
    next(err)
  }
}

/**
 * 文章列表（按分类）
 */
export async function postListBySortController(req, res, next) {
  try {
    const { lang, sortid } = req.params
    const page = Math.max(
      parseInt(req.params.page) || parseInt(req.query.page) || 1,
      1
    )
    const type = req.params.type || req.query.type || null
    const siteConfig = getSiteConfig()
    const limit = parseInt(siteConfig.pageSize) || 10

    const sortList = await querySortList(lang)
    const currentSort = sortList.find(
      s => String(s._id) === sortid || s.alias === sortid
    )
    if (!currentSort) {
      return render404(res, lang, siteConfig)
    }

    const cacheKey = `page:sort-list:${lang}:${sortid}:${page}:${type || 'all'}`
    let cached = cacheGet(cacheKey)
    if (cached) return res.render('pages/post-list', cached)

    const { list, total } = await queryPostList({
      languageCode: lang,
      page,
      limit,
      type,
      sortId: String(currentSort._id)
    })

    const vm = {
      lang,
      posts: list.map(mapPostToViewModel),
      sortList,
      currentSort,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      filterType: type,
      siteConfig,
      siteTitle: getSiteNameByLang(siteConfig, lang),
      siteDescription: getSiteDescriptionByLang(siteConfig, lang),
      pageTitle: currentSort.sortname || ''
    }

    cacheSet(cacheKey, vm, 300)
    return res.render('pages/post-list', vm)
  } catch (err) {
    next(err)
  }
}

/**
 * 文章列表（按标签）
 */
export async function postListByTagController(req, res, next) {
  try {
    const { lang, tagid } = req.params
    const page = Math.max(
      parseInt(req.params.page) || parseInt(req.query.page) || 1,
      1
    )
    const type = req.params.type || req.query.type || null
    const siteConfig = getSiteConfig()
    const limit = parseInt(siteConfig.pageSize) || 10

    const currentTag = await queryTagDetail(tagid, lang)
    if (!currentTag) {
      return render404(res, lang, siteConfig)
    }

    const sortList = await querySortList(lang)

    const { list, total } = await queryPostList({
      languageCode: lang,
      page,
      limit,
      type,
      tagId: String(currentTag._id)
    })

    const vm = {
      lang,
      posts: list.map(mapPostToViewModel),
      sortList,
      currentTag,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      filterType: type,
      siteConfig,
      siteTitle: getSiteNameByLang(siteConfig, lang),
      siteDescription: getSiteDescriptionByLang(siteConfig, lang),
      pageTitle: currentTag.tagname || ''
    }

    return res.render('pages/post-list', vm)
  } catch (err) {
    next(err)
  }
}

/**
 * 文章列表（按地点）
 */
export async function postListByMappointController(req, res, next) {
  try {
    const { lang, mappointid } = req.params
    const page = Math.max(
      parseInt(req.params.page) || parseInt(req.query.page) || 1,
      1
    )
    const type = req.params.type || req.query.type || null
    const siteConfig = getSiteConfig()
    const limit = parseInt(siteConfig.pageSize) || 10

    const currentMappoint = await queryMappointDetail(mappointid, lang)
    if (!currentMappoint) {
      return render404(res, lang, siteConfig)
    }

    const sortList = await querySortList(lang)

    const { list, total } = await queryPostList({
      languageCode: lang,
      page,
      limit,
      type,
      mappointId: String(currentMappoint._id)
    })

    const vm = {
      lang,
      posts: list.map(mapPostToViewModel),
      sortList,
      currentMappoint,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      filterType: type,
      siteConfig,
      siteTitle: getSiteNameByLang(siteConfig, lang),
      siteDescription: getSiteDescriptionByLang(siteConfig, lang),
      pageTitle: currentMappoint.title || ''
    }

    return res.render('pages/post-list', vm)
  } catch (err) {
    next(err)
  }
}

/**
 * 文章详情
 */
export async function postDetailController(req, res, next) {
  try {
    const { lang, id } = req.params
    const siteConfig = getSiteConfig()

    const cacheKey = `page:post-detail:${lang}:${id}`
    let cached = cacheGet(cacheKey)
    if (cached) return res.render('pages/post-detail', cached)

    const post = await queryPostDetail(id, lang)
    if (!post) {
      return render404(res, lang, siteConfig)
    }

    const sortList = await querySortList(lang)
    const hreflangAlternates = await queryHreflangAlternates(
      post.groupSourceId,
      lang
    )

    const vm = {
      lang,
      post: mapPostDetailToViewModel(post, hreflangAlternates),
      sortList,
      siteConfig,
      siteTitle: getSiteNameByLang(siteConfig, lang),
      siteDescription: getSiteDescriptionByLang(siteConfig, lang),
      pageTitle: post.title || ''
    }

    cacheSet(cacheKey, vm, 300)
    return res.render('pages/post-detail', vm)
  } catch (err) {
    next(err)
  }
}
