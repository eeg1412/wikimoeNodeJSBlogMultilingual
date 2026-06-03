export const POST_RELATED_SOURCE_FIELDS = [
  'postList',
  'tweetList',
  'contentPostList',
  'contentTweetList'
]

function normalizeRelatedPostSourceId(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  return String(value).trim()
}

export function getRelatedPostSourceId(record) {
  if (record === null || typeof record === 'undefined') {
    return ''
  }
  if (typeof record === 'string' || typeof record === 'number') {
    return normalizeRelatedPostSourceId(record)
  }
  if (typeof record !== 'object') {
    return ''
  }
  const sourceId = normalizeRelatedPostSourceId(record.sourceId)
  if (sourceId) {
    return sourceId
  }
  const id = normalizeRelatedPostSourceId(record._id)
  if (id) {
    return id
  }
  if (typeof record.toHexString === 'function') {
    return normalizeRelatedPostSourceId(record.toHexString())
  }
  return ''
}

export function collectRelatedPostSourceIds(sourcePost, targetPost = null) {
  const sourceIdSet = new Set()
  POST_RELATED_SOURCE_FIELDS.forEach(fieldName => {
    let sourceRelationList = []
    if (Array.isArray(sourcePost?.[fieldName])) {
      sourceRelationList = sourcePost[fieldName]
    }
    let targetRelationList = []
    if (Array.isArray(targetPost?.[fieldName])) {
      targetRelationList = targetPost[fieldName]
    }
    const targetRelationMap = new Map()
    targetRelationList.forEach(record => {
      const sourceId = getRelatedPostSourceId(record)
      if (sourceId) {
        targetRelationMap.set(sourceId, record)
      }
    })

    sourceRelationList.forEach(record => {
      const sourceId = getRelatedPostSourceId(record)
      if (!sourceId) {
        return
      }
      const targetRecord = targetRelationMap.get(sourceId)
      if (targetRecord && targetRecord.aiTranslationSkip === true) {
        return
      }
      sourceIdSet.add(sourceId)
    })
  })
  return Array.from(sourceIdSet)
}

export function hasPostRelatedSourcePosts(post) {
  if (!post) {
    return false
  }
  return POST_RELATED_SOURCE_FIELDS.some(fieldName => {
    let relationList = []
    if (Array.isArray(post[fieldName])) {
      relationList = post[fieldName]
    }
    return relationList.some(record => {
      return Boolean(getRelatedPostSourceId(record))
    })
  })
}
