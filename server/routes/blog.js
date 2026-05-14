var express = require('express')
var router = express.Router()
const { referrerRecord } = require('../utils/utils')
const cacheDataUtils = require('../config/cacheData')
const languageSettingsService = require('../api/multilingual-admin/services/languageSettingsService')

const checkIsReady = (req, res, next) => {
  const isReady = global.$isReady
  if (isReady) {
    next()
  } else {
    res.status(503).send('Service Unavailable')
  }
}

const checkIsBackuping = (req, res, next) => {
  const isBackuping = global.$isBackuping
  // 判断是POST PUT DELETE 方法
  if (isBackuping && ['POST', 'PUT', 'DELETE'].includes(req.method)) {
    res.status(400).json({ errors: [{ message: '系统正在维护，请稍后再试' }] })
  } else {
    next()
  }
}

const referrerRecordMiddleware = (req, res, next) => {
  referrerRecord(req.headers.referer, 'blogApi')
  next()
}

const checkBlogLanguageEnabled = async (req, res, next) => {
  try {
    const languageCode = cacheDataUtils.getRequestLanguageCode(req)
    if (!languageCode) {
      res.status(404).json({ errors: [{ message: 'languageCode不支持' }] })
      return
    }

    const isEnabled =
      await languageSettingsService.isBlogLanguageEnabled(languageCode)
    if (!isEnabled) {
      res.status(404).json({ errors: [{ message: '语言未启用' }] })
      return
    }

    next()
  } catch (error) {
    next(error)
  }
}

const blogRouteSetting = [
  {
    path: '/options',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/option/getoptionList')
  },
  // getnaviList
  {
    path: '/navi/list',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/navi/getnaviList')
  },
  // getPostList
  {
    path: '/post/list',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/post/getPostList')
  },
  // getBannerList
  {
    path: '/banner/list',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/banner/getBannerList')
  },
  // getSidebar
  {
    path: '/sidebar/list',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/sidebar/getSidebarList')
  },
  // getSortList
  // getSortList
  {
    path: '/sort/list',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/sort/getSortList')
  },
  // getPostArchiveList
  {
    path: '/post/archive',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/post/getPostArchiveList')
  },
  // get getPostDetail
  {
    path: '/post/detail',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/post/getPostDetail')
  },
  // getBangumiList
  {
    path: '/bangumi/list',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/bangumi/getBangumiList')
  },
  // getBangumiSeasonList
  {
    path: '/bangumi/season/list',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/bangumi/getBangumiSeasonList')
  },
  // getBangumiYearList
  {
    path: '/bangumi/year/list',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/bangumi/getBangumiYearList')
  },
  // getBangumiDetail
  {
    path: '/bangumi/detail',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/bangumi/getBangumiDetail')
  },
  // getMovieList
  {
    path: '/movie/list',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/movie/getMovieList')
  },
  // getMovieYearList
  {
    path: '/movie/year/list',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/movie/getMovieYearList')
  },
  // getMovieDetail
  {
    path: '/movie/detail',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/movie/getMovieDetail')
  },
  // getSortDetail
  {
    path: '/sort/detail',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/sort/getSortDetail')
  },
  // getTagDetail
  {
    path: '/tag/detail',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/tag/getTagDetail')
  },
  // getRandomTagList
  {
    path: '/tag/random/list',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/tag/getRandomTagList')
  },
  // getMappointList
  {
    path: '/mappoint/list',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/mappoint/getMappointList')
  },
  // getMappointDetail
  {
    path: '/mappoint/detail',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/mappoint/getMappointDetail')
  },
  // getMappointPostList
  {
    path: '/mappoint/post/list',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/mappoint/getMappointPostList')
  },
  // getGameList
  {
    path: '/game/list',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/game/getGameList')
  },
  // getPlayingGameList
  {
    path: '/game/playing/list',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/game/getPlayingGameList')
  },
  // getGamePlatformList
  {
    path: '/game/platform/list',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/game/getGamePlatformList')
  },
  // getGameDetail
  {
    path: '/game/detail',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/game/getGameDetail')
  },
  // getBookList
  {
    path: '/book/list',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/book/getBookList')
  },
  // getReadingBookList
  {
    path: '/book/reading/list',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/book/getReadingBookList')
  },
  // getBooktypeList
  {
    path: '/booktype/list',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/book/getBooktypeList')
  },
  // getBookDetail
  {
    path: '/book/detail',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/book/getBookDetail')
  },
  // getAttachmentList
  {
    path: '/attachment/list',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/attachment/getAttachmentList')
  },
  // getEventList
  {
    path: '/event/list',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/event/getEventList')
  },
  // getEventDetail
  {
    path: '/event/detail',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/event/getEventDetail')
  },
  // getTrendPostList
  {
    path: '/trend/post/list',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/trend/getTrendPostList')
  },
  // getVoteDetail
  {
    path: '/vote/detail',
    method: 'get',
    middleware: [],
    controller: require('../api/blog/vote/getVoteDetail')
  },
  // postVote
  {
    path: '/vote',
    method: 'post',
    middleware: [],
    controller: require('../api/blog/vote/postVote')
  }
]

blogRouteSetting.forEach(item => {
  const middleware = [
    checkIsReady,
    checkIsBackuping,
    checkBlogLanguageEnabled,
    referrerRecordMiddleware,
    ...item.middleware
  ]
  router[item.method](item.path, ...middleware, item.controller)
})

module.exports = router
