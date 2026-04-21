const { createHash } = require('crypto')

/**
 * sha256 十六进制摘要
 * @param {string|Buffer} input
 * @returns {string}
 */
function sha256Hex(input) {
  return createHash('sha256').update(input).digest('hex')
}

/**
 * 规范化文本后再做 sha256：trim、统一换行、折叠多空白
 * 用于翻译记忆与 sourceHash 比对
 * @param {string} text
 */
function normalizedTextHash(text) {
  if (text === null || text === undefined) {
    return sha256Hex('')
  }
  const normalized = String(text)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim()
  return sha256Hex(normalized)
}

/**
 * 对任意可序列化对象进行稳定哈希：按键名排序后 JSON.stringify
 * @param {any} obj
 */
function stableObjectHash(obj) {
  const stringify = value => {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value)
    }
    if (Array.isArray(value)) {
      return '[' + value.map(stringify).join(',') + ']'
    }
    const keys = Object.keys(value).sort()
    return (
      '{' +
      keys.map(k => JSON.stringify(k) + ':' + stringify(value[k])).join(',') +
      '}'
    )
  }
  return sha256Hex(stringify(obj))
}

module.exports = {
  sha256Hex,
  normalizedTextHash,
  stableObjectHash
}
