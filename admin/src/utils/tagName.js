export function normalizeTagName(value) {
  if (value === null || value === undefined) {
    return value
  }
  return String(value).trim().replace(/[\s\u3000]+/g, '-')
}

export function normalizeTagRecord(record) {
  if (!record || record.tagname === undefined) {
    return record
  }
  return {
    ...record,
    tagname: normalizeTagName(record.tagname)
  }
}
