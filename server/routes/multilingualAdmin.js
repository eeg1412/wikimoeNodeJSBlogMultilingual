var express = require('express')
var router = express.Router()
const mongoose = require('mongoose')
const multer = require('multer')
const { checkJWT, referrerRecord } = require('../utils/utils')
const { ERROR_CODES, sendError } = require('../utils/multilingualAdminResponse')

const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

const jwtVersion = 1
const localContentController = require('../api/multilingual-admin/localContentController')

const checkIsReady = (req, res, next) => {
  const isReady = global.$isReady
  if (isReady) {
    next()
    return
  }

  sendError(res, 503, ERROR_CODES.SERVICE_UNAVAILABLE)
}

const checkIsBackuping = (req, res, next) => {
  const isBackuping = global.$isBackuping
  if (isBackuping && ['POST', 'PUT', 'DELETE'].includes(req.method)) {
    sendError(res, 400, ERROR_CODES.BACKUP_IN_PROGRESS)
    return
  }

  next()
}

const referrerRecordMiddleware = (req, res, next) => {
  referrerRecord(req.headers.referer, 'multilingualAdminApi')
  next()
}

const checkAuth = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization || ''
    if (!authorization) {
      sendError(res, 401, ERROR_CODES.AUTH_REQUIRED)
      return
    }

    const token = authorization.split(' ')[1] || authorization
    const decoded = checkJWT(token)
    if (decoded.isError || !decoded.data) {
      sendError(res, 401, ERROR_CODES.AUTH_FAILED)
      return
    }

    req.adminData = decoded
    if (decoded.data.version !== jwtVersion) {
      sendError(res, 401, ERROR_CODES.AUTH_FAILED)
      return
    }

    if (!decoded.data.id || !mongoose.Types.ObjectId.isValid(decoded.data.id)) {
      sendError(res, 401, ERROR_CODES.AUTH_FAILED)
      return
    }

    const admin = await global.$mongodDB.source.repositories.users.findOne(
      { _id: new mongoose.Types.ObjectId(decoded.data.id) },
      undefined,
      { lean: true }
    )
    if (!admin || admin.disabled) {
      sendError(res, 403, ERROR_CODES.AUTH_FAILED)
      return
    }

    if (admin.pwversion !== decoded.data.pwversion) {
      sendError(res, 401, ERROR_CODES.AUTH_FAILED)
      return
    }

    req.admin = admin
    next()
  } catch (error) {
    sendError(res, 401, ERROR_CODES.AUTH_FAILED)
  }
}

const multilingualAdminRouteSetting = [
  {
    path: '/login',
    method: 'post',
    middleware: [],
    controller: require('../api/multilingual-admin/auth/login')
  },
  {
    path: '/loginuserinfo',
    method: 'get',
    middleware: [checkAuth],
    controller: require('../api/multilingual-admin/auth/getLoginUserInfo')
  },
  {
    path: '/dashboard/summary',
    method: 'get',
    middleware: [checkAuth],
    controller: require('../api/multilingual-admin/dashboard/getSummary')
  },
  {
    path: '/option/list',
    method: 'get',
    middleware: [checkAuth],
    controller: require('../api/multilingual-admin/option/getList')
  },
  {
    path: '/settings/language/list',
    method: 'get',
    middleware: [checkAuth],
    controller: require('../api/multilingual-admin/settings/language/getList')
  },
  {
    path: '/settings/language/update',
    method: 'put',
    middleware: [checkAuth],
    controller: require('../api/multilingual-admin/settings/language/update')
  },
  {
    path: '/navi/list',
    method: 'get',
    middleware: [checkAuth],
    controller: localContentController.getNaviList
  },
  {
    path: '/navi/detail',
    method: 'get',
    middleware: [checkAuth],
    controller: localContentController.getNaviDetail
  },
  {
    path: '/navi/create',
    method: 'post',
    middleware: [checkAuth],
    controller: localContentController.createNavi
  },
  {
    path: '/navi/update',
    method: 'put',
    middleware: [checkAuth],
    controller: localContentController.updateNavi
  },
  {
    path: '/navi/delete',
    method: 'delete',
    middleware: [checkAuth],
    controller: localContentController.deleteNavi
  },
  {
    path: '/banner/list',
    method: 'get',
    middleware: [checkAuth],
    controller: localContentController.getBannerList
  },
  {
    path: '/banner/create',
    method: 'post',
    middleware: [checkAuth],
    controller: localContentController.createBanner
  },
  {
    path: '/banner/update',
    method: 'put',
    middleware: [checkAuth],
    controller: localContentController.updateBanner
  },
  {
    path: '/banner/delete',
    method: 'delete',
    middleware: [checkAuth],
    controller: localContentController.deleteBanner
  },
  {
    path: '/banner/update/taxis',
    method: 'put',
    middleware: [checkAuth],
    controller: localContentController.updateBannerTaxis
  },
  {
    path: '/sidebar/list',
    method: 'get',
    middleware: [checkAuth],
    controller: localContentController.getSidebarList
  },
  {
    path: '/sidebar/create',
    method: 'post',
    middleware: [checkAuth],
    controller: localContentController.createSidebar
  },
  {
    path: '/sidebar/update',
    method: 'put',
    middleware: [checkAuth],
    controller: localContentController.updateSidebar
  },
  {
    path: '/sidebar/delete',
    method: 'delete',
    middleware: [checkAuth],
    controller: localContentController.deleteSidebar
  },
  {
    path: '/sidebar/update/taxis',
    method: 'put',
    middleware: [checkAuth],
    controller: localContentController.updateSidebarTaxis
  },
  {
    path: '/readerlog/list',
    method: 'get',
    middleware: [checkAuth],
    controller: require('../api/admin/readerlog/getReaderlogList')
  },
  {
    path: '/readerlog/stats',
    method: 'get',
    middleware: [checkAuth],
    controller: require('../api/admin/readerlog/getReaderlogStats')
  },
  {
    path: '/readerlog/delete',
    method: 'delete',
    middleware: [checkAuth],
    controller: require('../api/admin/readerlog/deleteReaderlog')
  },
  {
    path: '/referrer/list',
    method: 'get',
    middleware: [checkAuth],
    controller: require('../api/admin/referrer/getReferrerList')
  },
  {
    path: '/backup/create',
    method: 'post',
    middleware: [checkAuth],
    controller: require('../api/admin/backup/createBackup')
  },
  {
    path: '/backup/list',
    method: 'get',
    middleware: [checkAuth],
    controller: require('../api/admin/backup/getBackupList')
  },
  {
    path: '/backup/delete',
    method: 'delete',
    middleware: [checkAuth],
    controller: require('../api/admin/backup/deleteBackup')
  },
  {
    path: '/backup/update',
    method: 'put',
    middleware: [checkAuth],
    controller: require('../api/admin/backup/updateBackup')
  },
  {
    path: '/backup/mark/delete',
    method: 'put',
    middleware: [checkAuth],
    controller: require('../api/admin/backup/markBackupFileDelete')
  },
  {
    path: '/backup/detail',
    method: 'get',
    middleware: [checkAuth],
    controller: require('../api/admin/backup/getBackupDetail')
  },
  {
    path: '/backup/download',
    method: 'post',
    middleware: [],
    controller: require('../api/admin/backup/downloadBackup')
  },
  {
    path: '/backup/download/token',
    method: 'get',
    middleware: [checkAuth],
    controller: require('../api/admin/backup/getDownloadBackupToken')
  },
  {
    path: '/backup/restore',
    method: 'post',
    middleware: [checkAuth],
    controller: require('../api/admin/backup/restoreBackup')
  },
  {
    path: '/backup/upload/create',
    method: 'post',
    middleware: [checkAuth],
    controller: require('../api/admin/backup/createBackupUpload')
  },
  {
    path: '/backup/upload/chunk/list',
    method: 'get',
    middleware: [checkAuth],
    controller: require('../api/admin/backup/getUploadBackupFileChunkList')
  },
  {
    path: '/backup/upload/chunk/:id/:chunkindex',
    method: 'post',
    middleware: [checkAuth, upload.single('file')],
    controller: require('../api/admin/backup/uploadBackupFileChunk')
  },
  {
    path: '/backup/upload/merge',
    method: 'put',
    middleware: [checkAuth],
    controller: require('../api/admin/backup/mergeUploadBackupFile')
  },
  {
    path: '/source/post/import',
    method: 'post',
    middleware: [checkAuth],
    controller: require('../api/multilingual-admin/source/post/importPost')
  },
  {
    path: '/source/post/overwrite',
    method: 'post',
    middleware: [checkAuth],
    controller: require('../api/multilingual-admin/source/post/overwritePost')
  },
  {
    path: '/source/post/source-list',
    method: 'get',
    middleware: [checkAuth],
    controller: require('../api/multilingual-admin/source/post/getSourcePostList')
  },
  {
    path: '/source/post/list',
    method: 'get',
    middleware: [checkAuth],
    controller: require('../api/multilingual-admin/source/post/getPostList')
  },
  {
    path: '/source/post/detail',
    method: 'get',
    middleware: [checkAuth],
    controller: require('../api/multilingual-admin/source/post/getPostDetail')
  },
  {
    path: '/source/relation/list',
    method: 'get',
    middleware: [checkAuth],
    controller: require('../api/multilingual-admin/source/relation/getList')
  },
  {
    path: '/translation/post/create',
    method: 'post',
    middleware: [checkAuth],
    controller: require('../api/multilingual-admin/translation/post/createPost')
  },
  {
    path: '/translation/post/list-by-source',
    method: 'get',
    middleware: [checkAuth],
    controller: require('../api/multilingual-admin/translation/post/getPostListBySource')
  },
  {
    path: '/translation/post/detail',
    method: 'get',
    middleware: [checkAuth],
    controller: require('../api/multilingual-admin/translation/post/getPostDetail')
  },
  {
    path: '/translation/post/update',
    method: 'put',
    middleware: [checkAuth],
    controller: require('../api/multilingual-admin/translation/post/updatePost')
  },
  {
    path: '/translation/relation/update',
    method: 'put',
    middleware: [checkAuth],
    controller: require('../api/multilingual-admin/translation/relation/update')
  },
  {
    path: '/translation/relation/list',
    method: 'get',
    middleware: [checkAuth],
    controller: require('../api/multilingual-admin/translation/relation/getList')
  },
  {
    path: '/media/list',
    method: 'get',
    middleware: [checkAuth],
    controller: require('../api/multilingual-admin/media/getList')
  },
  {
    path: '/media/replace-local',
    method: 'post',
    middleware: [checkAuth, upload.single('file')],
    controller: require('../api/multilingual-admin/media/replaceLocal')
  },
  {
    path: '/media/convert-remote',
    method: 'post',
    middleware: [checkAuth],
    controller: require('../api/multilingual-admin/media/convertRemote')
  }
]

multilingualAdminRouteSetting.forEach(item => {
  const middleware = [
    checkIsReady,
    checkIsBackuping,
    referrerRecordMiddleware,
    ...item.middleware
  ]
  router[item.method](item.path, ...middleware, item.controller)
})

module.exports = router
