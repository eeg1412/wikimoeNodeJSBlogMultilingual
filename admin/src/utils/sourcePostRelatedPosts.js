export const POST_RELATED_SOURCE_FIELDS = [
  'postList',
  'tweetList',
  'contentPostList',
  'contentTweetList'
]

export function getRelatedPostSourceId(record) {
  if (!record || typeof record !== 'object') {
    return ''
  }
  return String(record.sourceId || record._id || '').trim()
}

export function collectRelatedPostSourceIds(sourcePost, targetPost = null) {
  const sourceIdSet = new Set()
  POST_RELATED_SOURCE_FIELDS.forEach(fieldName => {
    const sourceRelationList = Array.isArray(sourcePost?.[fieldName])
      ? sourcePost[fieldName]
      : []
    const targetRelationList = Array.isArray(targetPost?.[fieldName])
      ? targetPost[fieldName]
      : []
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
    const relationList = Array.isArray(post[fieldName]) ? post[fieldName] : []
    return relationList.some(record => {
      return Boolean(getRelatedPostSourceId(record))
    })
  })
}
