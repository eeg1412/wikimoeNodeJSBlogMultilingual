const mongoose = require('mongoose')
const env = require('../config/env')
const log4js = require('log4js')
const logger = log4js.getLogger('mongodb')

mongoose.set('strictQuery', true)

const connection = mongoose.connection

connection.on('connected', () => {
  logger.info('MongoDB 已连接:', env.DB_HOST)
})
connection.on('error', err => {
  logger.error('MongoDB 错误:', err.message)
})
connection.on('disconnected', () => {
  logger.warn('MongoDB 连接断开')
})

async function connect() {
  if (connection.readyState === 1 || connection.readyState === 2) {
    return connection
  }
  await mongoose.connect(env.DB_HOST, {
    serverSelectionTimeoutMS: 15000
  })
  return connection
}

module.exports = {
  mongoose,
  connection,
  connect
}
