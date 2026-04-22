import mongoose from 'mongoose'
import { DB_HOST } from '../config/env.js'
import { initOptions } from '../config/optionsInit.js'
import { initAdminUser } from '../config/adminInit.js'
import { initGlobalConfig } from '../config/globalConfig.js'
import { cacheData } from '../config/cacheData.js'

let mongodbErrorCount = 0
let dbInstance = null

export function getDb() {
  return dbInstance
}

export async function connectMongoDB() {
  const uri = DB_HOST()
  if (!uri) {
    console.error('[MongoDB] DB_HOST 未设置，无法连接数据库')
    process.exit(1)
  }

  // 注册重连/错误事件（必须在 connect() 之前注册，否则事件已触发时监听器还未就绪）
  const db = mongoose.connection

  db.on('error', error => {
    console.error('[MongoDB] 连接错误:', error.message || error)
    handleDbError()
  })

  db.on('close', () => {
    console.error('[MongoDB] 数据库断开，尝试重新连接...')
    handleDbError()
  })

  console.info('[MongoDB] 数据库连接中...')
  await mongoose.connect(uri)

  // await mongoose.connect() resolve 意味着连接已建立
  dbInstance = db
  console.info('[MongoDB] 数据库连接成功！')
  mongodbErrorCount = 0

  // 初始化系统
  await initOptions()
  await initAdminUser()
  await initGlobalConfig()
  await cacheData.refresh()

  global.$isReady = true
  console.info('[System] 系统初始化完成，服务就绪')

  return db
}

function handleDbError() {
  global.$isReady = false
  mongodbErrorCount++
  if (mongodbErrorCount > 10) {
    console.error('[MongoDB] 连接失败次数过多，程序退出')
    process.exit(1)
  }
  const retryMs = 10000 * mongodbErrorCount
  console.error(`[MongoDB] 将在 ${retryMs / 1000} 秒后重试`)
  setTimeout(() => {
    console.info('[MongoDB] 数据库重连中...')
    mongoose.connect(DB_HOST())
  }, retryMs)
}
