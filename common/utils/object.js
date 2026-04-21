function removeUndefinedFields(input) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  )
}

function stableSortObject(input) {
  if (Array.isArray(input)) {
    return input.map(stableSortObject)
  }
  if (!input || typeof input !== 'object') {
    return input
  }

  return Object.keys(input)
    .sort()
    .reduce((result, key) => {
      result[key] = stableSortObject(input[key])
      return result
    }, {})
}

function stableJSONStringify(input) {
  return JSON.stringify(stableSortObject(input))
}

function normalizeText(input) {
  return String(input || '')
    .replace(/\s+/g, ' ')
    .trim()
}

module.exports = {
  normalizeText,
  removeUndefinedFields,
  stableJSONStringify,
  stableSortObject
}