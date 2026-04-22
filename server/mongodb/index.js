const mongoose = require('mongoose')

let connectionPromise = null
let listenersRegistered = false

async function logMongoVersion() {
  const nativeDb = mongoose.connection.db

  if (!nativeDb) {
    return
  }

  try {
    const admin = nativeDb.admin()
    const buildInfo = await admin.command({ buildInfo: 1 })
    console.info(`MongoDB 版本：${buildInfo.version}`)
  } catch (error) {
    console.warn(`获取 MongoDB 版本失败：${error.message || error}`)
  }
}

function registerConnectionListeners() {
  if (listenersRegistered) {
    return
  }

  mongoose.connection.on('connected', function () {
    console.info('MongoDB 已连接')
  })

  mongoose.connection.on('error', function (error) {
    console.error(`MongoDB 连接错误：${error.message || error}`)
  })

  mongoose.connection.on('disconnected', function () {
    console.warn('MongoDB 连接已断开')
  })

  mongoose.connection.once('open', function () {
    logMongoVersion()
  })

  listenersRegistered = true
}

async function connectMongo() {
  if (!process.env.DB_HOST) {
    throw new Error('缺少 DB_HOST，无法连接 MongoDB')
  }

  if (connectionPromise) {
    return connectionPromise
  }

  registerConnectionListeners()

  connectionPromise = mongoose
    .connect(process.env.DB_HOST)
    .then(function () {
      return mongoose.connection
    })
    .catch(function (error) {
      connectionPromise = null
      throw error
    })

  return connectionPromise
}

module.exports = {
  connectMongo,
  mongoose
}
