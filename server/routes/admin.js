const express = require('express')

const requireAdminAuth = require('../middleware/requireAdminAuth')

function createAdminRouter() {
  const router = express.Router()

  router.post('/login', require('../api/admin/auth/login'))
  router.get(
    '/auth/login-log/list',
    requireAdminAuth({ roles: ['super_admin'] }),
    require('../api/admin/auth/getAdminLoginLogList')
  )
  router.post(
    '/import/post',
    requireAdminAuth(),
    require('../api/admin/import/createImportPost')
  )
  router.get(
    '/option/list',
    requireAdminAuth(),
    require('../api/admin/option/getOptionList')
  )
  router.get(
    '/option/entity-options',
    requireAdminAuth(),
    require('../api/admin/option/getEntityOptions')
  )
  router.put(
    '/option/update',
    requireAdminAuth({ roles: ['super_admin'] }),
    require('../api/admin/option/updateOption')
  )
  router.get(
    '/import/job/list',
    requireAdminAuth(),
    require('../api/admin/import/getImportJobList')
  )
  router.get(
    '/post/detail',
    requireAdminAuth(),
    require('../api/admin/post/getPostDetail')
  )
  router.get(
    '/post/list',
    requireAdminAuth(),
    require('../api/admin/post/getPostList')
  )
  router.get(
    '/post/publish-validate',
    requireAdminAuth(),
    require('../api/admin/post/validatePost')
  )
  router.put(
    '/post/update',
    requireAdminAuth(),
    require('../api/admin/post/updatePost')
  )
  router.put(
    '/security/admin-jwt-secret/regenerate',
    requireAdminAuth({ roles: ['super_admin'] }),
    require('../api/admin/security/regenerateAdminJwtSecret')
  )

  return router
}

module.exports = createAdminRouter
