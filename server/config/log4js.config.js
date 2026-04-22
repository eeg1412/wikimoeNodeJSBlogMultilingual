import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const logBase = join(__dirname, '../log')

export default {
  appenders: {
    consoleLog: { type: 'console' },
    systemMainLogFile: {
      type: 'dateFile',
      filename: `${logBase}/system/info/info.log`,
      pattern: 'yyyy-MM-dd',
      keepFileExt: true,
      alwaysIncludePattern: true,
      numBackups: 30,
      compress: true
    },
    systemMainErrorLogFile: {
      type: 'dateFile',
      filename: `${logBase}/system/error/error.log`,
      pattern: 'yyyy-MM-dd',
      keepFileExt: true,
      alwaysIncludePattern: true,
      numBackups: 30,
      compress: true
    },
    systemMainLog: {
      type: 'logLevelFilter',
      appender: 'systemMainLogFile',
      level: 'INFO',
      maxLevel: 'WARN'
    },
    systemMainErrorLog: {
      type: 'logLevelFilter',
      appender: 'systemMainErrorLogFile',
      level: 'ERROR'
    },
    accessLogFile: {
      type: 'dateFile',
      filename: `${logBase}/access/info/info.log`,
      pattern: 'yyyy-MM-dd',
      keepFileExt: true,
      alwaysIncludePattern: true,
      numBackups: 30,
      compress: true
    },
    accessLog: {
      type: 'logLevelFilter',
      appender: 'accessLogFile',
      level: 'INFO'
    },
    adminApiLogFile: {
      type: 'dateFile',
      filename: `${logBase}/admin/info/info.log`,
      pattern: 'yyyy-MM-dd',
      keepFileExt: true,
      alwaysIncludePattern: true,
      numBackups: 30,
      compress: true
    },
    adminApiErrorLogFile: {
      type: 'dateFile',
      filename: `${logBase}/admin/error/error.log`,
      pattern: 'yyyy-MM-dd',
      keepFileExt: true,
      alwaysIncludePattern: true,
      numBackups: 30,
      compress: true
    },
    adminApiLog: {
      type: 'logLevelFilter',
      appender: 'adminApiLogFile',
      level: 'INFO',
      maxLevel: 'WARN'
    },
    adminApiErrorLog: {
      type: 'logLevelFilter',
      appender: 'adminApiErrorLogFile',
      level: 'ERROR'
    }
  },
  categories: {
    default: {
      appenders: ['consoleLog', 'systemMainLog', 'systemMainErrorLog'],
      level: 'INFO'
    },
    access: { appenders: ['accessLog'], level: 'INFO' },
    admin: {
      appenders: ['consoleLog', 'adminApiLog', 'adminApiErrorLog'],
      level: 'INFO'
    }
  }
}
