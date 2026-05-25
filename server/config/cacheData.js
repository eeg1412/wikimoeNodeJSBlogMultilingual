const naviUtils = require('../mongodb/utils/navis')
const sidebarUtils = require('../mongodb/utils/sidebars')
const bannerUtils = require('../mongodb/utils/banners')
const sortUtils = require('../mongodb/utils/sorts')
const postUtils = require('../mongodb/utils/posts')
const bangumiUtils = require('../mongodb/utils/bangumis')
const movieUtils = require('../mongodb/utils/movies')
const bookUtils = require('../mongodb/utils/books')
const gameUtils = require('../mongodb/utils/games')
const commentUtils = require('../mongodb/utils/comments')

const utils = require('../utils/utils')
const {
  DEFAULT_LANGUAGE_CODE,
  SUPPORTED_LANGUAGE_CODES,
  normalizeLanguageCode
} = require('../utils/language')
const {
  getSourceSeoSettings
} = require('../utils/sourceSeoSettings')

function getLanguageCode(languageCodeInput) {
  if (
    languageCodeInput === undefined ||
    languageCodeInput === null ||
    languageCodeInput === ''
  ) {
    return DEFAULT_LANGUAGE_CODE
  }

  return normalizeLanguageCode(languageCodeInput)
}

function getLanguageCache(languageCodeInput) {
  const languageCode = getLanguageCode(languageCodeInput)
  if (!languageCode) {
    return null
  }

  if (!global.$cacheData.byLanguage) {
    global.$cacheData.byLanguage = {}
  }

  if (!global.$cacheData.byLanguage[languageCode]) {
    global.$cacheData.byLanguage[languageCode] = {}
  }

  return global.$cacheData.byLanguage[languageCode]
}

function getTranslationParams(languageCodeInput, params = {}) {
  const languageCode = getLanguageCode(languageCodeInput)
  if (!languageCode) {
    return null
  }

  return {
    ...params,
    languageCode,
    recordKind: 'translation'
  }
}

exports.getRequestLanguageCode = function (req) {
  const languageCodeInput =
    req.query?.languageCode || req.body?.languageCode || req.params?.code
  return getLanguageCode(languageCodeInput)
}

exports.getLanguageCache = getLanguageCache
exports.getTranslationParams = getTranslationParams

exports.invalidateSortListCache = function (
  languageCodeInput = DEFAULT_LANGUAGE_CODE
) {
  const languageCode = getLanguageCode(languageCodeInput)
  if (!languageCode) {
    return null
  }

  const languageCache = getLanguageCache(languageCode)
  if (!languageCache) {
    return null
  }

  languageCache.sortList = null
  return languageCache
}

exports.getNaviList = async function (
  languageCodeInput = DEFAULT_LANGUAGE_CODE
) {
  const languageCode = getLanguageCode(languageCodeInput)
  const languageCache = getLanguageCache(languageCode)
  console.info(`naviList get:${languageCode}`)
  const sort = {
    taxis: 1,
    _id: -1
  }
  const promise = new Promise((resolve, reject) => {
    naviUtils
      .find(
        getTranslationParams(languageCode, { status: 1 }),
        sort,
        undefined,
        { lean: true }
      )
      .then(data => {
        // 根据返回的data，配合parent字段，生成树形结构
        const jsonData = data
        const treeData = utils.generateTreeData(jsonData)
        languageCache.naviList = treeData
        resolve(treeData)
        console.info(`naviList get success:${languageCode}`)
      })
      .catch(err => {
        languageCache.naviList = null
        reject(err)
        console.error(`naviList get fail:${languageCode}`)
      })
  })
  return promise
}

exports.getSortList = async function (
  languageCodeInput = DEFAULT_LANGUAGE_CODE
) {
  const languageCode = getLanguageCode(languageCodeInput)
  const languageCache = getLanguageCache(languageCode)
  console.info(`sortList get:${languageCode}`)
  const sort = {
    taxis: 1,
    _id: -1
  }
  const promise = new Promise((resolve, reject) => {
    sortUtils
      .find(getTranslationParams(languageCode), sort, undefined, { lean: true })
      .then(data => {
        // 根据返回的data，配合parent字段，生成树形结构
        const jsonData = data
        const treeData = utils.generateTreeData(jsonData)
        languageCache.sortList = treeData
        resolve(treeData)
        console.info(`sortList get success:${languageCode}`)
      })
      .catch(err => {
        languageCache.sortList = null
        reject(err)
        console.error(`sortList get fail:${languageCode}`)
      })
  })
  return promise
}

exports.getSidebarList = async function (
  languageCodeInput = DEFAULT_LANGUAGE_CODE
) {
  const languageCode = getLanguageCode(languageCodeInput)
  const languageCache = getLanguageCache(languageCode)
  console.info(`sidebarList get:${languageCode}`)
  const sort = {
    taxis: 1,
    _id: -1
  }
  const promise = await new Promise((resolve, reject) => {
    sidebarUtils
      .find(
        getTranslationParams(languageCode, { status: 1 }),
        sort,
        undefined,
        { lean: true }
      )
      .then(data => {
        languageCache.sidebarList = data
        resolve(data)
        // 更新 getBangumiSeasonList
        this.getBangumiSeasonList(languageCode)
        // 更新 getPlayingGameList
        this.getPlayingGameList(languageCode)
        // 更新 getReadingBookList
        this.getReadingBookList(languageCode)
        // 重置
        exports.resetCacheDataByType(12, 'trendPostListData', languageCode)
        exports.resetCacheDataByType(4, 'randomTagListData', languageCode)
        console.info(`sidebarList get success:${languageCode}`)
      })
      .catch(err => {
        languageCache.sidebarList = null
        reject(err)
        console.error(`sidebarList get fail:${languageCode}`)
      })
  })
  return promise
}

exports.resetCacheDataByType = (
  sidebarType,
  cacheDataName,
  languageCodeInput = DEFAULT_LANGUAGE_CODE
) => {
  const languageCache = getLanguageCache(languageCodeInput)
  // 从全局缓存中获取侧边栏列表
  const sidebarList = languageCache.sidebarList || []
  // 查找指定类型的侧边栏
  const targetSidebar = sidebarList.find(item => item.type === sidebarType)

  // 如果不存在指定类型的侧边栏，或者其count属性小于等于0
  if (!targetSidebar || targetSidebar.count <= 0) {
    languageCache[cacheDataName] = null
    return true
  }

  // 检查缓存中的数据是否需要更新
  const cacheLimit = languageCache[cacheDataName]?.limit || 0
  if (cacheLimit !== targetSidebar.count) {
    languageCache[cacheDataName] = null
    return true
  }

  return false
}

exports.getBannerList = async function (
  languageCodeInput = DEFAULT_LANGUAGE_CODE
) {
  const languageCode = getLanguageCode(languageCodeInput)
  const languageCache = getLanguageCache(languageCode)
  console.info(`bannerList get:${languageCode}`)
  const sort = {
    taxis: 1,
    _id: -1
  }
  const promise = new Promise((resolve, reject) => {
    bannerUtils
      .find(
        getTranslationParams(languageCode, { status: 1 }),
        sort,
        undefined,
        { lean: true }
      )
      .then(data => {
        languageCache.bannerList = data
        resolve(data)
        console.info(`bannerList get success:${languageCode}`)
      })
      .catch(err => {
        languageCache.bannerList = null
        reject(err)
        console.error(`bannerList get fail:${languageCode}`)
      })
  })
  return promise
}

// 获取最新评论列表,根据date
exports.getCommentList = async function () {
  console.info('commentList get')
  // 查询侧边栏列表里type为3的侧边栏
  const sidebarList = []
  const commentSidebar = sidebarList.find(item => {
    return item.type === 3
  })
  // 不存在type为3的侧边栏
  if (!commentSidebar) {
    global.$cacheData.commentList = null
    // reject
    return []
  }
  // 存在type为3的侧边栏,获取count
  const count = commentSidebar.count || 0
  // 如果count小于等于0，不获取最新评论列表
  if (count <= 0) {
    global.$cacheData.commentList = null
    // reject
    return []
  }
  const sort = {
    date: -1,
    _id: -1
  }
  const promise = new Promise((resolve, reject) => {
    commentUtils
      .findPage({ status: 1 }, sort, 1, count, undefined, {
        postFilter: 'status _id alias type',
        lean: true
      })
      .then(data => {
        let list = data.list
        // 需要获取的key数组
        const keys = [
          '_id',
          'avatar',
          'content',
          'date',
          'nickname',
          'url',
          'post',
          'likes',
          'isAdmin'
        ]
        // 去掉post.status不为1的list项
        list = list.filter(item => {
          return item.post && item.post.status === 1
        })

        // 将list的email字段替换为gravatar头像
        list.forEach(item => {
          const email = item.email
          if (email) {
            item.avatar = utils.md5hex(email)
          }
          if (item.user) {
            item.avatar = item.user.photo
            item.nickname = item.user.nickname
            item.isAdmin = true
          } else {
            item.isAdmin = false
          }
          // 只保留需要的key
          Object.keys(item).forEach(key => {
            if (!keys.includes(key)) {
              delete item[key]
            }
          })
        })
        global.$cacheData.commentList = list
        resolve(list)
        console.info('commentList get success')
      })
      .catch(err => {
        global.$cacheData.commentList = null
        reject(err)
        console.error('commentList get fail')
      })
  })
  return promise
}

// 根据服务器提供的时区，查询每个月的status为1的post总数，返回的数据包含 2023年12月 和 count
exports.getPostArchiveList = async function (
  languageCodeInput = DEFAULT_LANGUAGE_CODE
) {
  const languageCode = getLanguageCode(languageCodeInput)
  const languageCache = getLanguageCache(languageCode)
  console.info(`postArchive get:${languageCode}`)
  const sourceSettings = await getSourceSeoSettings()
  const siteTimeZone = sourceSettings.siteTimeZone || 'Asia/Shanghai'
  const promise = new Promise((resolve, reject) => {
    postUtils
      .aggregate([
        {
          $match: getTranslationParams(languageCode, {
            status: 1,
            // type 1 和 2
            type: { $in: [1, 2] }
          })
        },
        {
          $group: {
            _id: {
              year: { $year: { date: '$date', timezone: siteTimeZone } },
              month: { $month: { date: '$date', timezone: siteTimeZone } }
            },
            count: { $sum: 1 }
          }
        },
        {
          $sort: {
            '_id.year': -1,
            '_id.month': -1
          }
        }
      ])
      .then(data => {
        languageCache.postArchiveList = data
        resolve(data)
        console.info(`postArchive get success:${languageCode}`)
      })
      .catch(err => {
        languageCache.postArchiveList = null
        reject(err)
        console.error(`postArchive get fail:${languageCode}`)
      })
  })
  return promise
}
// 获取bangumi的年份表
exports.getBangumiYearList = async function (
  languageCodeInput = DEFAULT_LANGUAGE_CODE
) {
  const languageCode = getLanguageCode(languageCodeInput)
  const languageCache = getLanguageCache(languageCode)
  console.info(`bangumiYearList get:${languageCode}`)
  const promise = new Promise((resolve, reject) => {
    bangumiUtils
      .aggregate([
        {
          $match: getTranslationParams(languageCode, {
            status: 1
          })
        },
        {
          $facet: {
            // count: [
            //   {
            //     $count: "total"
            //   }
            // ],
            data: [
              {
                $group: {
                  _id: '$year',
                  seasons: { $addToSet: '$season' }
                }
              },
              {
                $project: {
                  _id: 0,
                  year: '$_id',
                  seasonList: '$seasons'
                }
              },
              {
                $sort: {
                  year: -1
                }
              }
            ]
          }
        }
      ])
      .then(data => {
        let base = {
          // total: 0,
          list: []
        }
        const data_ = data[0]
        if (data_) {
          // if (data_.count.length > 0) {
          //   base.total = data_.count[0].total
          // }
          if (data_.data.length > 0) {
            base.list = data_.data
          }
        }

        languageCache.bangumiYearList = base
        resolve(data)
        console.info(`bangumiYearList get success:${languageCode}`)
      })
      .catch(err => {
        languageCache.bangumiYearList = null
        reject(err)
        console.error(`bangumiYearList get fail:${languageCode}`)
      })
  })
  return promise
}

// 获取当季追番
exports.getBangumiSeasonList = async function (
  languageCodeInput = DEFAULT_LANGUAGE_CODE
) {
  const languageCode = getLanguageCode(languageCodeInput)
  const languageCache = getLanguageCache(languageCode)
  console.info(`bangumiSeasonList get:${languageCode}`)
  // 查询当前语言侧边栏列表里type为13的侧边栏
  const sidebarList = languageCache.sidebarList || []
  const bangumiSeasonSidebar = sidebarList.find(item => {
    return item.type === 13
  })
  // 不存在type为13的侧边栏
  if (!bangumiSeasonSidebar) {
    languageCache.bangumiSeasonObj = null
    // reject
    return []
  }
  // 存在type为13的侧边栏,获取count
  const count = bangumiSeasonSidebar.count || 0
  // 如果count小于等于0，不获取当季追番
  if (count <= 0) {
    languageCache.bangumiSeasonObj = null
    // reject
    return []
  }
  const sort = {
    rating: -1,
    _id: -1
  }
  const yearSeason = utils.getYearSeason()
  const promise = new Promise((resolve, reject) => {
    bangumiUtils
      .findPage(
        getTranslationParams(languageCode, {
          status: 1,
          year: yearSeason.year,
          season: yearSeason.season
        }),
        sort,
        1,
        count,
        '_id cover label rating season status summary title year giveUp urlList',
        { lean: true }
      )
      .then(data => {
        languageCache.bangumiSeasonObj = {
          year: yearSeason.year,
          season: yearSeason.season,
          list: data.list
        }
        resolve(languageCache.bangumiSeasonObj)
        console.info(`bangumiSeasonList get success:${languageCode}`)
      })
      .catch(err => {
        languageCache.bangumiSeasonObj = null
        reject(err)
        console.error(`bangumiSeasonList get fail:${languageCode}`)
      })
  })
  return promise
}
// 获取电影观看年份
exports.getMovieYearList = async function (
  languageCodeInput = DEFAULT_LANGUAGE_CODE
) {
  const languageCode = getLanguageCode(languageCodeInput)
  const languageCache = getLanguageCache(languageCode)
  console.info(`movieYearList get:${languageCode}`)
  const promise = new Promise((resolve, reject) => {
    movieUtils
      .aggregate([
        {
          $match: getTranslationParams(languageCode, {
            status: 1,
            // 有year month day
            year: { $ne: null },
            month: { $ne: null },
            day: { $ne: null }
          })
        },
        {
          $facet: {
            data: [
              {
                $group: {
                  _id: '$year',
                  count: { $sum: 1 }
                }
              },
              {
                $project: {
                  _id: 0,
                  year: '$_id',
                  count: 1
                }
              },
              {
                $sort: {
                  year: -1
                }
              }
            ]
          }
        }
      ])
      .then(data => {
        let base = {
          list: []
        }
        const data_ = data[0]
        if (data_) {
          if (data_.data.length > 0) {
            base.list = data_.data
          }
        }
        languageCache.movieYearList = base
        resolve(data)
        console.info(`movieYearList get success:${languageCode}`)
      })
      .catch(err => {
        languageCache.movieYearList = null
        reject(err)
        console.error(`movieYearList get fail:${languageCode}`)
      })
  })
  return promise
}

// 检查当季追番是否需要更新
exports.checkBangumiSeasonList = async function (
  languageCodeInput = DEFAULT_LANGUAGE_CODE
) {
  const languageCode = getLanguageCode(languageCodeInput)
  const languageCache = getLanguageCache(languageCode)
  const yearSeason = utils.getYearSeason()
  if (
    languageCache.bangumiSeasonObj &&
    languageCache.bangumiSeasonObj?.year === yearSeason.year &&
    languageCache.bangumiSeasonObj?.season === yearSeason.season
  ) {
    return languageCache.bangumiSeasonObj
  }
  console.info(`bangumiSeason should update:${languageCode}`)
  await this.getBangumiSeasonList(languageCode)
  return languageCache.bangumiSeasonObj
}

// 获取攻略中的游戏
exports.getPlayingGameList = async function (
  languageCodeInput = DEFAULT_LANGUAGE_CODE
) {
  const languageCode = getLanguageCode(languageCodeInput)
  const languageCache = getLanguageCache(languageCode)
  console.info(`playingGameList get:${languageCode}`)
  const sidebarList = languageCache.sidebarList || []
  const playingGameSidebar = sidebarList.find(item => {
    return item.type === 14
  })
  if (!playingGameSidebar) {
    languageCache.playingGameList = null
    return []
  }
  const count = playingGameSidebar.count || 0
  if (count <= 0) {
    languageCache.playingGameList = null
    return []
  }
  const sort = {
    rating: -1,
    _id: -1
  }
  const params = getTranslationParams(languageCode, {
    status: 1,
    giveUp: { $ne: true },
    startTime: { $ne: null },
    endTime: { $eq: null }
  })
  const promise = new Promise((resolve, reject) => {
    gameUtils
      .findPage(
        params,
        sort,
        1,
        count,
        '_id cover endTime gamePlatform label rating screenshotAlbum startTime status summary title urlList giveUp',
        { lean: true }
      )
      .then(data => {
        languageCache.playingGameList = data.list
        resolve(data.list)
        console.info(`playingGameList get success:${languageCode}`)
      })
      .catch(err => {
        languageCache.playingGameList = null
        reject(err)
        console.error(`playingGameList get fail:${languageCode}`)
      })
  })
  return promise
}

// 获取阅读中的书籍
exports.getReadingBookList = async function (
  languageCodeInput = DEFAULT_LANGUAGE_CODE
) {
  const languageCode = getLanguageCode(languageCodeInput)
  const languageCache = getLanguageCache(languageCode)
  console.info(`readingBookList get:${languageCode}`)
  const sidebarList = languageCache.sidebarList || []
  const readingBookSidebar = sidebarList.find(item => {
    return item.type === 15
  })
  if (!readingBookSidebar) {
    languageCache.readingBookList = null
    return []
  }
  const count = readingBookSidebar.count || 0
  if (count <= 0) {
    languageCache.readingBookList = null
    return []
  }
  const sort = {
    rating: -1,
    _id: -1
  }
  const params = getTranslationParams(languageCode, {
    status: 1,
    giveUp: { $ne: true },
    startTime: { $ne: null },
    endTime: { $eq: null }
  })
  const promise = new Promise((resolve, reject) => {
    bookUtils
      .findPage(
        params,
        sort,
        1,
        count,
        '_id cover endTime booktype label rating startTime status summary title urlList giveUp',
        { lean: true }
      )
      .then(data => {
        languageCache.readingBookList = data.list
        resolve(data.list)
        console.info(`readingBookList get success:${languageCode}`)
      })
      .catch(err => {
        languageCache.readingBookList = null
        reject(err)
        console.error(`readingBookList get fail:${languageCode}`)
      })
  })
  return promise
}

exports.refreshLanguageCache = async function (
  languageCodeInput = DEFAULT_LANGUAGE_CODE
) {
  const languageCode = getLanguageCode(languageCodeInput)
  if (!languageCode) {
    return null
  }

  await this.getNaviList(languageCode)
  await this.getSidebarList(languageCode)
  await this.getBannerList(languageCode)
  await this.getSortList(languageCode)
  await this.getPostArchiveList(languageCode)
  await this.getBangumiYearList(languageCode)
  await this.getMovieYearList(languageCode)
  return getLanguageCache(languageCode)
}

exports.refreshAllLanguageCache = async function () {
  for (const languageCode of SUPPORTED_LANGUAGE_CODES) {
    await this.refreshLanguageCache(languageCode)
  }
}
