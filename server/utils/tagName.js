function normalizeTagName(value) {
  if (value === null || value === undefined) {
    return value
  }

  return String(value).trim().replace(/[\s\u3000]+/g, '-')
}

module.exports = {
  normalizeTagName
}
