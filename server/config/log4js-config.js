const fs = require('fs-extra')
const log4js = require('log4js')
const env = require('./env')

fs.ensureDirSync(env.LOG_DIR)

log4js.configure({
  appenders: {
    console: { type: 'console' },
    app: {
      type: 'dateFile',
      filename: `${env.LOG_DIR}/app.log`,
      pattern: 'yyyy-MM-dd',
      keepFileExt: true,
      maxLogSize: 10 * 1024 * 1024,
      numBackups: env.MAX_HISTORYLOGS_SIZE
    }
  },
  categories: {
    default: { appenders: ['console', 'app'], level: 'info' },
    access: { appenders: ['console', 'app'], level: 'info' },
    adminApi: { appenders: ['console', 'app'], level: 'info' },
    blogApi: { appenders: ['console', 'app'], level: 'info' },
    importService: { appenders: ['console', 'app'], level: 'info' },
    translationService: { appenders: ['console', 'app'], level: 'info' }
  }
})

module.exports = log4js