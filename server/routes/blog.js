const express = require('express')

const blogController = require('../controllers/blog/blogController')

function createBlogRouter() {
  const router = express.Router()

  router.get('/api/blog/options', blogController.getOptionsApi)
  router.get('/api/blog/post/list', blogController.getPostListApi)
  router.get('/api/blog/post/detail', blogController.getPostDetailApi)
  router.get('/api/blog/post/archive', blogController.getArchiveApi)
  router.get('/api/blog/sort/list', blogController.getSortListApi)
  router.get('/api/blog/sort/detail', blogController.getSortDetailApi)
  router.get('/api/blog/tag/detail', blogController.getTagDetailApi)
  router.get('/api/blog/mappoint/detail', blogController.getMappointDetailApi)

  router.get('/:lang', blogController.renderHomePage)
  router.get('/:lang/post/list', blogController.renderPostListPage)
  router.get('/:lang/post/list/:page', blogController.renderPostListPage)
  router.get('/:lang/post/list/:page/:type', blogController.renderPostListPage)
  router.get('/:lang/post/:id', blogController.renderPostDetailPage)
  router.get('/:lang/post/list/sort/:sortid', blogController.renderPostListPage)
  router.get(
    '/:lang/post/list/sort/:sortid/:page',
    blogController.renderPostListPage
  )
  router.get(
    '/:lang/post/list/sort/:sortid/:page/:type',
    blogController.renderPostListPage
  )
  router.get('/:lang/post/list/tag/:tagid', blogController.renderPostListPage)
  router.get(
    '/:lang/post/list/tag/:tagid/:page',
    blogController.renderPostListPage
  )
  router.get(
    '/:lang/post/list/tag/:tagid/:page/:type',
    blogController.renderPostListPage
  )
  router.get(
    '/:lang/post/list/mappoint/:mappointid',
    blogController.renderPostListPage
  )
  router.get(
    '/:lang/post/list/mappoint/:mappointid/:page',
    blogController.renderPostListPage
  )
  router.get(
    '/:lang/post/list/mappoint/:mappointid/:page/:type',
    blogController.renderPostListPage
  )

  return router
}

module.exports = createBlogRouter
