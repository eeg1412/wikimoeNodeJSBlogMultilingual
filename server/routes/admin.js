import { Router } from 'express'
import { requireAdminAuth, requireSuperAdmin } from '../middleware/adminAuth.js'

// Auth
import loginHandler from '../api/admin/auth/login.js'
import loginUserInfoHandler from '../api/admin/auth/loginUserInfo.js'

// Security
import regenerateJwtHandler from '../api/admin/security/regenerateJwtSecret.js'

// AdminLoginLog
import loginLogListHandler from '../api/admin/adminLoginLog/list.js'

// Import
import importPostHandler from '../api/admin/importJob/importPost.js'
import importJobListHandler from '../api/admin/importJob/list.js'

// Post
import postGroupListHandler from '../api/admin/post/groupList.js'
import postDetailHandler from '../api/admin/post/detail.js'
import postUpdateHandler from '../api/admin/post/update.js'
import postTranslateHandler from '../api/admin/post/translate.js'
import postPublishHandler from '../api/admin/post/publish.js'
import postUnpublishHandler from '../api/admin/post/unpublish.js'

// Author
import authorListHandler from '../api/admin/author/list.js'
import authorUpdateHandler from '../api/admin/author/update.js'

// Sort
import sortListHandler from '../api/admin/sort/list.js'
import sortUpdateHandler from '../api/admin/sort/update.js'

// Tag
import tagListHandler from '../api/admin/tag/list.js'
import tagUpdateHandler from '../api/admin/tag/update.js'

// Mappoint
import mappointListHandler from '../api/admin/mappoint/list.js'
import mappointUpdateHandler from '../api/admin/mappoint/update.js'

// Attachment
import attachmentListHandler from '../api/admin/attachment/list.js'
import attachmentUpdateHandler from '../api/admin/attachment/update.js'
import {
  default as attachmentUploadHandler,
  uploadMiddleware
} from '../api/admin/attachment/upload.js'

// Entity handlers（Bangumi / Movie / Game / Book / Event）
import {
  bangumiListHandler,
  bangumiUpdateHandler,
  movieListHandler,
  movieUpdateHandler,
  gameListHandler,
  gameUpdateHandler,
  bookListHandler,
  bookUpdateHandler,
  eventListHandler,
  eventUpdateHandler
} from '../api/admin/entity/entityHandlers.js'

// Vote
import voteListHandler from '../api/admin/vote/list.js'
import voteUpdateHandler from '../api/admin/vote/update.js'

// Option
import optionGetHandler from '../api/admin/option/get.js'
import optionUpdateHandler from '../api/admin/option/update.js'

// Translation Memory
import translationMemoryListHandler from '../api/admin/translationMemory/list.js'
import translationMemoryApproveHandler from '../api/admin/translationMemory/approve.js'

// AiTranslationLog
import aiLogListHandler from '../api/admin/aiTranslationLog/list.js'

const router = Router()

// ────────────── 公开接口 ──────────────
router.post('/login', loginHandler)

// ────────────── 受保护接口 ──────────────
const auth = requireAdminAuth()

router.get('/loginuserinfo', auth, loginUserInfoHandler)

// Security（仅超级管理员）
router.put(
  '/security/admin-jwt-secret/regenerate',
  requireSuperAdmin,
  regenerateJwtHandler
)

// AdminLoginLog
router.get('/adminloginlog/list', auth, loginLogListHandler)

// Import
router.post('/import/post', auth, importPostHandler)
router.get('/import/job/list', auth, importJobListHandler)

// Post
router.get('/post/group/list', auth, postGroupListHandler)
router.get('/post/detail/:id', auth, postDetailHandler)
router.put('/post/update/:id', auth, postUpdateHandler)
router.post('/post/translate/:id', auth, postTranslateHandler)
router.post('/post/publish/:id', auth, postPublishHandler)
router.post('/post/unpublish/:id', auth, postUnpublishHandler)

// Author
router.get('/author/list', auth, authorListHandler)
router.put('/author/update/:id', auth, authorUpdateHandler)

// Sort
router.get('/sort/list', auth, sortListHandler)
router.put('/sort/update/:id', auth, sortUpdateHandler)

// Tag
router.get('/tag/list', auth, tagListHandler)
router.put('/tag/update/:id', auth, tagUpdateHandler)

// Mappoint
router.get('/mappoint/list', auth, mappointListHandler)
router.put('/mappoint/update/:id', auth, mappointUpdateHandler)

// Attachment
router.get('/attachment/list', auth, attachmentListHandler)
router.post(
  '/attachment/upload-localized',
  auth,
  uploadMiddleware,
  attachmentUploadHandler
)
router.put('/attachment/update/:id', auth, attachmentUpdateHandler)

// Bangumi
router.get('/bangumi/list', auth, bangumiListHandler)
router.put('/bangumi/update/:id', auth, bangumiUpdateHandler)

// Movie
router.get('/movie/list', auth, movieListHandler)
router.put('/movie/update/:id', auth, movieUpdateHandler)

// Game
router.get('/game/list', auth, gameListHandler)
router.put('/game/update/:id', auth, gameUpdateHandler)

// Book
router.get('/book/list', auth, bookListHandler)
router.put('/book/update/:id', auth, bookUpdateHandler)

// Event
router.get('/event/list', auth, eventListHandler)
router.put('/event/update/:id', auth, eventUpdateHandler)

// Vote
router.get('/vote/list', auth, voteListHandler)
router.put('/vote/update/:id', auth, voteUpdateHandler)

// Option
router.get('/option/list', auth, optionGetHandler)
router.put('/option/update', auth, optionUpdateHandler)

// Translation Memory
router.get('/translation-memory/list', auth, translationMemoryListHandler)
router.post(
  '/translation-memory/approve/:id',
  auth,
  translationMemoryApproveHandler
)

// AI Translation Log
router.get('/aitranslationlog/list', auth, aiLogListHandler)

export default router
