function stableSortValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableSortValue)
  }

  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const sortedObject = {}
    const keys = Object.keys(value).sort()

    for (const key of keys) {
      sortedObject[key] = stableSortValue(value[key])
    }

    return sortedObject
  }

  return value
}

function stableStringify(value) {
  return JSON.stringify(stableSortValue(value))
}

module.exports = {
  stableStringify,
  stableSortValue
}
