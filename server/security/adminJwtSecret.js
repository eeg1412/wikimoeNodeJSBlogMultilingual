const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const ADMIN_SECRET_FILE_NAME = 'JWTSecretAdmin.key'

function getSecretDirectory() {
  return path.resolve(__dirname, '..', 'secret')
}

function getAdminSecretPath() {
  return path.join(getSecretDirectory(), ADMIN_SECRET_FILE_NAME)
}

function generateAdminJwtSecret() {
  return crypto.randomBytes(64).toString('hex')
}

function tryRestrictFilePermission(secretPath) {
  try {
    fs.chmodSync(secretPath, 0o600)
  } catch (error) {
    if (process.platform !== 'win32') {
      throw error
    }
  }
}

function writeSecretFile(secretPath, secretValue) {
  fs.mkdirSync(path.dirname(secretPath), { recursive: true })
  fs.writeFileSync(secretPath, secretValue, { encoding: 'utf8', mode: 0o600 })
  tryRestrictFilePermission(secretPath)
}

function ensureAdminJwtSecret(options = {}) {
  const rotate = options.rotate === true
  const secretPath = getAdminSecretPath()

  if (!fs.existsSync(secretPath) || rotate) {
    writeSecretFile(secretPath, generateAdminJwtSecret())
  }

  const secretValue = fs.readFileSync(secretPath, 'utf8').trim()

  if (!secretValue) {
    throw new Error('管理员 JWT 密钥文件为空')
  }

  return secretValue
}

function rotateAdminJwtSecret() {
  return ensureAdminJwtSecret({ rotate: true })
}

module.exports = {
  ADMIN_SECRET_FILE_NAME,
  ensureAdminJwtSecret,
  getAdminSecretPath,
  getSecretDirectory,
  rotateAdminJwtSecret
}
