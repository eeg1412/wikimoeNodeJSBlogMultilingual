const mongoose = require('mongoose')

if (!process.env.DB_HOST_MULTILINGUAL) {
  console.error(
    '请在根目录下创建.env文件，并添加多语言数据库地址 DB_HOST_MULTILINGUAL。'
  )
  process.exit(1)
}

const connection = mongoose.createConnection(process.env.DB_HOST_MULTILINGUAL)

function waitReady() {
  if (connection.readyState === 1) {
    return Promise.resolve(connection)
  }

  return new Promise((resolve, reject) => {
    function cleanup() {
      connection.off('open', handleOpen)
      connection.off('error', handleError)
    }

    function handleOpen() {
      cleanup()
      resolve(connection)
    }

    function handleError(error) {
      cleanup()
      reject(error)
    }

    connection.once('open', handleOpen)
    connection.once('error', handleError)
  })
}

module.exports = {
  connection,
  get isReady() {
    return connection.readyState === 1
  },
  get readyState() {
    return connection.readyState
  },
  waitReady
}
