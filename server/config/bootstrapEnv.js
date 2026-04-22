const fs = require('fs')
const path = require('path')

const BOOTSTRAP_ENV_KEYS = Object.freeze([
  'DB_HOST',
  'LOCAL_ATTACHMENT_STORAGE_DIR',
  'INIT_ADMIN_USERNAME',
  'INIT_ADMIN_PASSWORD',
  'INIT_ADMIN_NICKNAME'
])

function getProjectRoot() {
  return path.resolve(__dirname, '..', '..')
}

function normalizeValue(rawValue) {
  const trimmedValue = rawValue.trim()

  if (
    (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) ||
    (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
  ) {
    return trimmedValue.slice(1, -1)
  }

  return trimmedValue
}

function parseEnvFile(fileContent) {
  const parsedEnv = {}
  const lines = fileContent.split(/\r?\n/)

  for (const line of lines) {
    const trimmedLine = line.trim()

    if (!trimmedLine || trimmedLine.startsWith('#')) {
      continue
    }

    const equalsIndex = trimmedLine.indexOf('=')
    if (equalsIndex === -1) {
      throw new Error(`非法 env 行：${trimmedLine}`)
    }

    const key = trimmedLine.slice(0, equalsIndex).trim()
    const value = trimmedLine.slice(equalsIndex + 1)

    if (!key) {
      throw new Error(`发现空 env 键名：${trimmedLine}`)
    }

    parsedEnv[key] = normalizeValue(value)
  }

  return parsedEnv
}

function validateEnvFileKeys(parsedEnv, envFilePath) {
  const invalidKeys = Object.keys(parsedEnv).filter(
    key => !BOOTSTRAP_ENV_KEYS.includes(key)
  )

  if (invalidKeys.length > 0) {
    throw new Error(
      `${envFilePath} 包含未允许的启动引导键：${invalidKeys.join(', ')}`
    )
  }
}

function getMissingKeys() {
  return BOOTSTRAP_ENV_KEYS.filter(key => {
    const value = process.env[key]
    return !value || !String(value).trim()
  })
}

function loadBootstrapEnv(options = {}) {
  const envFilePath = options.envFilePath || path.join(getProjectRoot(), '.env')

  if (!fs.existsSync(envFilePath)) {
    throw new Error(`缺少启动引导 env 文件：${envFilePath}`)
  }

  const parsedEnv = parseEnvFile(fs.readFileSync(envFilePath, 'utf8'))
  validateEnvFileKeys(parsedEnv, envFilePath)

  for (const key of BOOTSTRAP_ENV_KEYS) {
    if (Object.prototype.hasOwnProperty.call(parsedEnv, key)) {
      process.env[key] = parsedEnv[key]
    }
  }

  const missingKeys = getMissingKeys()
  if (missingKeys.length > 0) {
    throw new Error(`缺少必填启动引导键：${missingKeys.join(', ')}`)
  }

  return {
    envFilePath,
    values: BOOTSTRAP_ENV_KEYS.reduce((result, key) => {
      result[key] = process.env[key]
      return result
    }, {})
  }
}

module.exports = {
  BOOTSTRAP_ENV_KEYS,
  getProjectRoot,
  loadBootstrapEnv,
  parseEnvFile
}
