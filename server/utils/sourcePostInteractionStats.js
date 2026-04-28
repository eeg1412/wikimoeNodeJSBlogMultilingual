function normalizeSourceId(sourceId) {
  if (!sourceId) {
    return ''
  }

  return String(sourceId)
}

async function buildSourcePostStatsMap(postList = []) {
  const sourcePostsRepository = global.$mongodDB?.source?.repositories?.posts
  if (!sourcePostsRepository) {
    return new Map()
  }

  const sourceIdList = Array.from(
    new Set(
      postList
        .map(item => normalizeSourceId(item?.sourceId))
        .filter(Boolean)
    )
  )
  if (sourceIdList.length === 0) {
    return new Map()
  }

  const sourcePostList = await sourcePostsRepository.find(
    {
      _id: {
        $in: sourceIdList
      }
    },
    'likes shares comnum',
    {
      lean: true
    }
  )

  return new Map(
    sourcePostList.map(item => [normalizeSourceId(item?._id), item])
  )
}

function applySourcePostStats(post, sourcePostStatsMap) {
  if (!post) {
    return post
  }

  const sourceId = normalizeSourceId(post.sourceId)
  if (!sourceId) {
    return post
  }

  const sourcePostStats = sourcePostStatsMap.get(sourceId)
  if (!sourcePostStats) {
    return post
  }

  if (typeof sourcePostStats.likes === 'number') {
    post.likes = sourcePostStats.likes
  }

  if (typeof sourcePostStats.shares === 'number') {
    post.shares = sourcePostStats.shares
  }

  if (typeof sourcePostStats.comnum === 'number') {
    post.comnum = sourcePostStats.comnum
  }

  return post
}

async function syncSourcePostInteractionStats(postList = []) {
  const sourcePostStatsMap = await buildSourcePostStatsMap(postList)
  postList.forEach(item => {
    applySourcePostStats(item, sourcePostStatsMap)
  })

  return postList
}

module.exports = {
  applySourcePostStats,
  buildSourcePostStatsMap,
  syncSourcePostInteractionStats
}