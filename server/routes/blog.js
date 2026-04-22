import { Router } from 'express'

import optionsHandler from '../api/blog/options/get.js'
import postListHandler from '../api/blog/post/list.js'
import postDetailHandler from '../api/blog/post/detail.js'
import postArchiveHandler from '../api/blog/post/archive.js'
import sortListHandler from '../api/blog/sort/list.js'
import sortDetailHandler from '../api/blog/sort/detail.js'
import tagDetailHandler from '../api/blog/tag/detail.js'
import mappointDetailHandler from '../api/blog/mappoint/detail.js'

const router = Router()

// 前台公开 API（按语言过滤，lang 由 query param 传入）
router.get('/options', optionsHandler)
router.get('/:lang/post/list', postListHandler)
router.get('/:lang/post/detail/:id', postDetailHandler)
router.get('/:lang/post/archive', postArchiveHandler)
router.get('/:lang/sort/list', sortListHandler)
router.get('/:lang/sort/detail/:alias', sortDetailHandler)
router.get('/:lang/tag/detail/:id', tagDetailHandler)
router.get('/:lang/mappoint/detail/:id', mappointDetailHandler)

export default router
