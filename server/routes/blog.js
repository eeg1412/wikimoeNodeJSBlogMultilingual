const express = require('express')
const router = express.Router()
const asyncHandler = require('../utils/asyncHandler')
const {
  cachedJsonMiddleware,
  cachedTextMiddleware
} = require('../utils/cachedResponse')

// 默认 TTL：读接口 60s；SEO 资源 10min；options 60s。
const LIST_TTL = 60 * 1000
const SEO_TTL = 10 * 60 * 1000
const OPTIONS_TTL = 60 * 1000

function normalizeQueryKey(req) {
  const keys = Object.keys(req.query || {}).sort()
  return keys.map(k => `${k}=${req.query[k]}`).join('&')
}

function langScope(req) {
  const lang = req.query.lang || req.query.languageCode || 'default'
  return `blog:${lang}`
}

const optionsCache = cachedJsonMiddleware(req => ({
  scope: 'options',
  key: `options:${req.query.lang || 'all'}`,
  ttlMs: OPTIONS_TTL
}))

const blogListCache = cachedJsonMiddleware(req => ({
  scope: langScope(req),
  key: `${req.path}?${normalizeQueryKey(req)}`,
  ttlMs: LIST_TTL
}))

const archiveCache = cachedJsonMiddleware(req => ({
  scope: `blog:archive:${req.query.lang || 'default'}`,
  key: `archive?${normalizeQueryKey(req)}`,
  ttlMs: LIST_TTL
}))

const sitemapCache = cachedTextMiddleware(() => ({
  scope: 'seo',
  key: 'sitemap.xml',
  ttlMs: SEO_TTL,
  contentType: 'application/xml'
}))
const robotsCache = cachedTextMiddleware(() => ({
  scope: 'seo',
  key: 'robots.txt',
  ttlMs: SEO_TTL,
  contentType: 'text/plain'
}))
const adsCache = cachedTextMiddleware(() => ({
  scope: 'seo',
  key: 'ads.txt',
  ttlMs: SEO_TTL,
  contentType: 'text/plain'
}))

router.get(
  '/options',
  optionsCache,
  asyncHandler(require('../api/blog/getOptions'))
)

router.get(
  '/post/list',
  blogListCache,
  asyncHandler(require('../api/blog/getPostList'))
)
router.get(
  '/post/detail',
  blogListCache,
  asyncHandler(require('../api/blog/getPostDetail'))
)
router.get(
  '/post/archive',
  archiveCache,
  asyncHandler(require('../api/blog/getPostArchive'))
)

router.get(
  '/sort/list',
  blogListCache,
  asyncHandler(require('../api/blog/getSortList'))
)
router.get(
  '/sort/detail',
  blogListCache,
  asyncHandler(require('../api/blog/getSortDetail'))
)

router.get(
  '/tag/detail',
  blogListCache,
  asyncHandler(require('../api/blog/getTagDetail'))
)
router.get(
  '/mappoint/detail',
  blogListCache,
  asyncHandler(require('../api/blog/getMappointDetail'))
)

// SEO
router.get(
  '/sitemap.xml',
  sitemapCache,
  asyncHandler(require('../api/blog/getSitemap'))
)
router.get(
  '/robots.txt',
  robotsCache,
  asyncHandler(require('../api/blog/getRobotsTxt'))
)
router.get('/ads.txt', adsCache, asyncHandler(require('../api/blog/getAdsTxt')))

module.exports = router
