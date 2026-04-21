const jwt = require('jsonwebtoken')
const env = require('../config/env')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const SECRET_FILE = path.resolve(__dirname, '../secret/jwtAdminSecret.txt')

/**
 * 读取或生成管理员 JWT 密钥：
 *   1. 优先使用 env.JWT_SECRET_ADMIN
 *   2. 否则读取 secret/jwtAdminSecret.txt
 *   3. 否则自动生成并写入
 */
function ensureAdminSecret() {
  if (env.JWT_SECRET_ADMIN) {
    return env.JWT_SECRET_ADMIN
  }
  try {
    if (fs.existsSync(SECRET_FILE)) {
      const v = fs.readFileSync(SECRET_FILE, 'utf8').trim()
      if (v) return v
    }
  } catch (err) {
    // ignore
  }
  const generated = crypto.randomBytes(48).toString('hex')
  try {
    fs.mkdirSync(path.dirname(SECRET_FILE), { recursive: true })
    fs.writeFileSync(SECRET_FILE, generated, 'utf8')
  } catch (err) {
    // 即使写入失败也返回内存值
  }
  return generated
}

const SECRET = ensureAdminSecret()

function signAdminToken(payload, options) {
  return jwt.sign(
    payload,
    SECRET,
    Object.assign({ expiresIn: '7d' }, options || {})
  )
}

function verifyAdminToken(token) {
  try {
    return jwt.verify(token, SECRET)
  } catch (err) {
    return null
  }
}

module.exports = {
  signAdminToken,
  verifyAdminToken
}
