const mongoose = require('mongoose')
const { isSupportedLanguage } = require('@wikimoe-ml/common/constants')
const { badRequest } = require('../../utils/errors')

function parseLang(req) {
  const lang = String(req.query.lang || '').trim()
  if (!lang) {
    throw badRequest('缺少 lang 参数')
  }
  if (!isSupportedLanguage(lang)) {
    throw badRequest('lang 参数不支持')
  }
  return lang
}

function parsePage(req, fallback) {
  const raw = req.query.page
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) {
    return fallback || 1
  }
  return n
}

function parseLimit(req, defaultLimit, maxLimit) {
  const raw = req.query.limit
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 1) {
    return defaultLimit
  }
  if (n > maxLimit) {
    return maxLimit
  }
  return n
}

function isObjectId(id) {
  return (
    typeof id === 'string' && id.length === 24 && mongoose.isValidObjectId(id)
  )
}

function escapeRegex(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

module.exports = {
  parseLang,
  parsePage,
  parseLimit,
  isObjectId,
  escapeRegex
}
