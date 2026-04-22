const crypto = require('crypto')

const { stableStringify } = require('./stableStringify')

function createHash(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex')
}

function createObjectHash(value) {
  return createHash(stableStringify(value))
}

module.exports = {
  createHash,
  createObjectHash
}
