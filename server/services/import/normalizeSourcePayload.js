const {
  normalizeSourceUrl
} = require('../../../common/utils/sourceUrlNormalizer')

function normalizeSourcePayloadValue(value, options) {
  if (Array.isArray(value)) {
    return value.map(function (item) {
      return normalizeSourcePayloadValue(item, options)
    })
  }

  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const normalizedObject = {}

    for (const [key, objectValue] of Object.entries(value)) {
      normalizedObject[key] = normalizeSourcePayloadValue(objectValue, options)
    }

    return normalizedObject
  }

  if (typeof value === 'string') {
    return normalizeSourceUrl(value, options)
  }

  return value
}

module.exports = {
  normalizeSourcePayloadValue
}
