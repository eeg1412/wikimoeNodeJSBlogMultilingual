function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function buildKeywordQuery(keyword, fields = []) {
  if (!keyword || !Array.isArray(fields) || fields.length === 0) {
    return null
  }

  const normalizedKeyword = String(keyword).trim()
  if (!normalizedKeyword) {
    return null
  }

  const regex = new RegExp(escapeRegex(normalizedKeyword), 'i')

  return {
    $or: fields.map(field => ({
      [field]: regex
    }))
  }
}
