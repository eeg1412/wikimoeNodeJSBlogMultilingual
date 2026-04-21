const log4js = require('log4js')
const path = require('path')

log4js.configure({
  appenders: {
    console: { type: 'console' },
    access: {
      type: 'dateFile',
      filename: path.resolve(__dirname, '../log/access.log'),
      pattern: '.yyyy-MM-dd',
      keepFileExt: true,
      numBackups: 14
    },
    app: {
      type: 'dateFile',
      filename: path.resolve(__dirname, '../log/app.log'),
      pattern: '.yyyy-MM-dd',
      keepFileExt: true,
      numBackups: 14
    }
  },
  categories: {
    default: { appenders: ['console', 'app'], level: 'info' },
    access: { appenders: ['access'], level: 'info' },
    mongodb: { appenders: ['console', 'app'], level: 'info' },
    import: { appenders: ['console', 'app'], level: 'info' },
    translation: { appenders: ['console', 'app'], level: 'info' }
  }
})

module.exports = log4js
