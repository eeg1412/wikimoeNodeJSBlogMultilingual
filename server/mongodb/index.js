const cacheDataUtils = require('../config/cacheData')
const languageSettingsService = require('../api/multilingual-admin/services/languageSettingsService')
const rssToolUtils = require('../utils/rss')
const sitemapToolUtils = require('../utils/sitemap')
const {
  refreshSourceSeoSettingsCache
} = require('../utils/sourceSeoSettings')
const sourceConnectionInfo = require('./sourceConnection')
const multilingualConnectionInfo = require('./multilingualConnection')
const registerModels = require('./modelFactory/registerModels')
const buildSourceRepositories = require('./sourceRepositories')
const buildMultilingualRepositories = require('./multilingualRepositories')

let mongodbErrorCount = 0
let isInitializing = false
console.info('数据库连接中...')

const sourceModels = registerModels(sourceConnectionInfo.connection)
const multilingualModels = registerModels(multilingualConnectionInfo.connection)
const sourceRepositories = buildSourceRepositories(sourceModels)
const multilingualRepositories =
  buildMultilingualRepositories(multilingualModels)
const db = {
  source: {
    connection: sourceConnectionInfo.connection,
    repositories: sourceRepositories
  },
  multilingual: {
    connection: multilingualConnectionInfo.connection,
    repositories: multilingualRepositories
  }
}

function handleDbError(error) {
  global.$isReady = false
  mongodbErrorCount++
  if (mongodbErrorCount > 10) {
    console.error('数据库连接失败次数过多，程序退出')
    process.exit(1)
  }

  const message = error && error.message ? error.message : error
  console.error('数据库连接或初始化失败：', message)
}

async function logMongoDBVersion() {
  try {
    const nativeDb = multilingualConnectionInfo.connection.db
    if (!nativeDb) throw new Error('无法获取原生 MongoDB db 对象')
    const admin = nativeDb.admin()
    const buildInfo = await admin.command({ buildInfo: 1 })
    console.info(`MongoDB 版本：${buildInfo.version}`)
  } catch (err) {
    console.warn('获取MongoDB版本信息失败：', err.message || err)
  }
}

async function initializeMultilingualRuntime() {
  if (isInitializing || global.$isReady) {
    return
  }

  if (!sourceConnectionInfo.isReady || !multilingualConnectionInfo.isReady) {
    return
  }

  isInitializing = true

  try {
    await logMongoDBVersion()
    mongodbErrorCount = 0
    // 更新时注意同时更新还原时的缓存
    await refreshSourceSeoSettingsCache()
    await languageSettingsService.refreshLanguageSettingsCache()
    await cacheDataUtils.refreshAllLanguageCache()
    await rssToolUtils.reflushRSS()
    await sitemapToolUtils.reflushSitemap()
    global.$isReady = true
    console.info('多语言数据库初始化完成！')
  } catch (error) {
    handleDbError(error)
  } finally {
    isInitializing = false
  }
}

function bindConnectionEvents(name, connection) {
  connection.on('open', async () => {
    console.info(`${name}数据库连接成功！`)
    await initializeMultilingualRuntime()
  })

  connection.on('error', function (error) {
    console.error(`${name}数据库连接错误: ` + error)
    handleDbError(error)
  })

  connection.on('close', function () {
    console.error(`${name}数据库断开`)
    handleDbError(`${name}数据库断开`)
  })
}

bindConnectionEvents('源站', sourceConnectionInfo.connection)
bindConnectionEvents('多语言', multilingualConnectionInfo.connection)
initializeMultilingualRuntime()

module.exports = db
