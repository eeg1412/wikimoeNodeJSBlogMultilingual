const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const env = require('../config/env')
const HttpError = require('./httpError')

const ADMIN_JWT_VERSION = 1

function getAdminSecret() {
  if (env.JWT_SECRET_ADMIN) {
    return env.JWT_SECRET_ADMIN
  }
  return crypto.createHash('sha256').update('wikimoe-multilingual-admin').digest('hex')
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 10)
}

function comparePassword(password, hashedPassword) {
  return bcrypt.compareSync(password, hashedPassword)
}

function createAdminToken(admin, remember) {
  return jwt.sign(
    {
      id: String(admin._id),
      username: admin.username,
      role: admin.role,
      pwversion: admin.pwversion,
      version: ADMIN_JWT_VERSION
    },
    getAdminSecret(),
    {
      expiresIn: remember ? '365d' : '12h'
    }
  )
}

function verifyAdminToken(token) {
  try {
    const decoded = jwt.verify(token, getAdminSecret())
    if (decoded.version !== ADMIN_JWT_VERSION) {
      throw new HttpError(401, '认证失败')
    }
    return decoded
  } catch (error) {
    if (error instanceof HttpError) {
      throw error
    }
    throw new HttpError(401, '认证失败')
  }
}

module.exports = {
  comparePassword,
  createAdminToken,
  hashPassword,
  verifyAdminToken
}