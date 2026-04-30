function normalizeSourceId(sourceId) {
  if (!sourceId) {
    return ''
  }

  return String(sourceId)
}

const SOURCE_POST_STAT_FIELDS = ['views', 'likes', 'shares', 'comnum']

function isSourceInteractionSortType(sorttype) {
  return [
    'views_ascending',
    'views_descending',
    'comnum_ascending',
    'comnum_descending',
    'likes_ascending',
    'likes_descending'
  ].includes(sorttype)
}

function getSourceInteractionSortConfig(sorttype) {
  switch (sorttype) {
    case 'views_ascending':
      return { field: 'views', order: 1 }
    case 'views_descending':
      return { field: 'views', order: -1 }
    case 'comnum_ascending':
      return { field: 'comnum', order: 1 }
    case 'comnum_descending':
      return { field: 'comnum', order: -1 }
    case 'likes_ascending':
      return { field: 'likes', order: 1 }
    case 'likes_descending':
      return { field: 'likes', order: -1 }
    default:
      return null
  }
}

function getComparableStatValue(value) {
  return typeof value === 'number' ? value : 0
}

async function buildSourcePostStatsMap(postList = []) {
  const sourcePostsRepository = global.$mongodDB?.source?.repositories?.posts
  if (!sourcePostsRepository) {
    throw new Error('源站文章仓库不可用，无法获取源站文章统计')
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
    SOURCE_POST_STAT_FIELDS.join(' '),
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
    throw new Error('文章缺少源站 sourceId，无法获取源站文章统计')
  }

  const sourcePostStats = sourcePostStatsMap.get(sourceId)
  if (!sourcePostStats) {
    throw new Error(`源站文章统计不存在: ${sourceId}`)
  }

  SOURCE_POST_STAT_FIELDS.forEach(field => {
    post[field] =
      typeof sourcePostStats[field] === 'number' ? sourcePostStats[field] : 0
  })

  return post
}

async function syncSourcePostInteractionStats(postList = []) {
  const sourcePostStatsMap = await buildSourcePostStatsMap(postList)
  postList.forEach(item => {
    applySourcePostStats(item, sourcePostStatsMap)
  })

  return postList
}

async function sortPostListBySourceInteractionStats(postList = [], sorttype) {
  const sortConfig = getSourceInteractionSortConfig(sorttype)
  if (!sortConfig || postList.length === 0) {
    return postList
  }

  await syncSourcePostInteractionStats(postList)

  return postList.sort((left, right) => {
    const leftValue = getComparableStatValue(left?.[sortConfig.field])
    const rightValue = getComparableStatValue(right?.[sortConfig.field])
    const statDiff =
      sortConfig.order === 1
        ? leftValue - rightValue
        : rightValue - leftValue

    if (statDiff !== 0) {
      return statDiff
    }

    return String(right?._id || '').localeCompare(String(left?._id || ''))
  })
}

module.exports = {
  applySourcePostStats,
  buildSourcePostStatsMap,
  getSourceInteractionSortConfig,
  isSourceInteractionSortType,
  sortPostListBySourceInteractionStats,
  syncSourcePostInteractionStats
}
