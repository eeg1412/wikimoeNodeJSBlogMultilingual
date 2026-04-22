import { Router } from 'express'
import { SUPPORTED_LANGUAGES } from '../../common/constants/index.js'
import { getSiteConfig } from '../config/globalConfig.js'

// 博客页面控制器（统一在 blogPageController.js 中）
import {
  homeController,
  postListController,
  postDetailController,
  postListBySortController,
  postListByTagController,
  postListByMappointController
} from '../controllers/blogPageController.js'

const router = Router()

// ────────────── 根路径跳转 ──────────────
router.get('/', (req, res) => {
  const siteConfig = getSiteConfig()
  const defaultLang = siteConfig.defaultLanguageCode || 'en'
  return res.redirect(302, `/${defaultLang}`)
})

// ────────────── 语言前缀校验中间件 ──────────────
router.use('/:lang*', (req, res, next) => {
  const { lang } = req.params
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    return res
      .status(404)
      .render('pages/404', { lang: 'en', siteConfig: getSiteConfig() })
  }
  next()
})

// ────────────── 博客端页面路由 ──────────────

// 首页
router.get('/:lang', homeController)

// 文章列表（注意 sort/tag/mappoint 路由要在 :id 路由前面）
router.get('/:lang/post/list/sort/:sortid', postListBySortController)
router.get('/:lang/post/list/sort/:sortid/:page', postListBySortController)
router.get(
  '/:lang/post/list/sort/:sortid/:page/:type',
  postListBySortController
)

router.get('/:lang/post/list/tag/:tagid', postListByTagController)
router.get('/:lang/post/list/tag/:tagid/:page', postListByTagController)
router.get('/:lang/post/list/tag/:tagid/:page/:type', postListByTagController)

router.get(
  '/:lang/post/list/mappoint/:mappointid',
  postListByMappointController
)
router.get(
  '/:lang/post/list/mappoint/:mappointid/:page',
  postListByMappointController
)
router.get(
  '/:lang/post/list/mappoint/:mappointid/:page/:type',
  postListByMappointController
)

router.get('/:lang/post/list', postListController)
router.get('/:lang/post/list/:page', postListController)
router.get('/:lang/post/list/:page/:type', postListController)

// 详情
router.get('/:lang/post/:id', postDetailController)

export default router
