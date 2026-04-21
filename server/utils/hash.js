const crypto = require('crypto')
const { stableJSONStringify } = require('../../common/utils/object')

function sha256(input) {
  return crypto.createHash('sha256').update(String(input || '')).digest('hex')
}

function hashObject(input) {
  return sha256(stableJSONStringify(input))
}

module.exports = {
  hashObject,
  sha256
}