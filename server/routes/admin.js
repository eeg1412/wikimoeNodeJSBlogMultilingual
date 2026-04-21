const express = require('express')
const multer = require('multer')
const router = express.Router()

const adminAuth = require('../utils/adminAuth')
const asyncHandler = require('../utils/asyncHandler')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
})

// === 无需鉴权 ===
router.post('/login', asyncHandler(require('../api/admin/auth/login')))

// === 鉴权之后 ===
router.use(adminAuth)

router.get('/me', asyncHandler(require('../api/admin/auth/me')))
router.get('/site/info', asyncHandler(require('../api/admin/site/siteInfo')))
router.get(
  '/dashboard/summary',
  asyncHandler(require('../api/admin/dashboard/getDashboardSummary'))
)

// 导入
router.post(
  '/import/post',
  asyncHandler(require('../api/admin/import/importPost'))
)

// 翻译
router.post(
  '/translation/text',
  asyncHandler(require('../api/admin/translation/translateText'))
)
router.post(
  '/translation/html',
  asyncHandler(require('../api/admin/translation/translateHtml'))
)
router.post(
  '/translation/memory/approve',
  asyncHandler(require('../api/admin/translation/approveMemory'))
)
router.get(
  '/translation/memory/list',
  asyncHandler(require('../api/admin/translation/listMemories'))
)
router.post(
  '/translation/memory/delete',
  asyncHandler(require('../api/admin/translation/deleteMemory'))
)

// 附件
router.get(
  '/attachments/list',
  asyncHandler(require('../api/admin/attachments/listAttachments'))
)
router.post(
  '/attachments/upload',
  upload.single('file'),
  asyncHandler(require('../api/admin/attachments/uploadAttachment'))
)
router.post(
  '/attachments/register-remote',
  asyncHandler(require('../api/admin/attachments/registerRemote'))
)
router.post(
  '/attachments/update',
  asyncHandler(require('../api/admin/attachments/updateAttachment'))
)
router.post(
  '/attachments/delete',
  asyncHandler(require('../api/admin/attachments/deleteAttachment'))
)

// 文章
router.get('/post/list', asyncHandler(require('../api/admin/post/listPosts')))
router.get(
  '/post/group/list',
  asyncHandler(require('../api/admin/post/listPostGroups'))
)
router.get('/post/detail', asyncHandler(require('../api/admin/post/getPost')))
router.post(
  '/post/update',
  asyncHandler(require('../api/admin/post/updatePost'))
)
router.post(
  '/post/validate',
  asyncHandler(require('../api/admin/post/validatePost'))
)
router.post(
  '/post/publish',
  asyncHandler(require('../api/admin/post/publishPost'))
)
router.post(
  '/post/unpublish',
  asyncHandler(require('../api/admin/post/unpublishPost'))
)

// 实体（共享实体通用 CRUD）
router.get(
  '/entity/:type/list',
  asyncHandler(require('../api/admin/entity/listEntity'))
)
router.get(
  '/entity/:type/detail',
  asyncHandler(require('../api/admin/entity/getEntity'))
)
router.post(
  '/entity/:type/update',
  asyncHandler(require('../api/admin/entity/updateEntity'))
)
router.post(
  '/entity/:type/approve',
  asyncHandler(require('../api/admin/entity/approveEntity'))
)
router.post(
  '/entity/:type/translate',
  asyncHandler(require('../api/admin/entity/translateEntity'))
)

// 站点 options
router.get(
  '/options',
  asyncHandler(require('../api/admin/options/listOptions'))
)
router.post(
  '/options/update',
  asyncHandler(require('../api/admin/options/updateOptions'))
)

module.exports = router
