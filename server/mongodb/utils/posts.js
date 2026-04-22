import Post from '../models/post.js'

/**
 * 分页查询文章列表
 */
export async function findPostPage({
  query = {},
  sort = { date: -1 },
  page = 1,
  limit = 20
} = {}) {
  const skip = (page - 1) * limit
  const [list, total] = await Promise.all([
    Post.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('author', 'nickname')
      .populate('sort', 'sortname')
      .lean(),
    Post.countDocuments(query)
  ])
  return { list, total }
}

/**
 * 按 groupSourceId 聚合列表（后台 group/list 页面用）
 */
export async function findPostGroupList({
  page = 1,
  limit = 20,
  filter = {}
} = {}) {
  const skip = (page - 1) * limit
  const pipeline = [
    { $match: filter },
    {
      $group: {
        _id: '$groupSourceId',
        sourceId: { $first: '$sourceId' },
        sourceAlias: { $first: '$sourceAlias' },
        type: { $first: '$type' },
        langs: {
          $push: {
            languageCode: '$languageCode',
            status: '$status',
            translationStatus: '$translationStatus',
            _id: '$_id'
          }
        },
        lastUpdated: { $max: '$updatedAt' }
      }
    },
    { $sort: { lastUpdated: -1 } },
    { $skip: skip },
    { $limit: limit }
  ]
  const countPipeline = [
    { $match: filter },
    { $group: { _id: '$groupSourceId' } },
    { $count: 'total' }
  ]
  const [list, countResult] = await Promise.all([
    Post.aggregate(pipeline),
    Post.aggregate(countPipeline)
  ])
  const total = countResult[0]?.total || 0
  return { list, total }
}

/**
 * 按 sourceId + languageCode 查找文章
 */
export async function findPostBySourceIdLang(sourceId, languageCode) {
  return Post.findOne({ sourceId, languageCode }).lean()
}

/**
 * 按 alias 或 _id 查找文章（前台详情页用）
 */
export async function findPostForDetail(idOrAlias, languageCode) {
  let post = await Post.findOne({ alias: idOrAlias, languageCode, status: 1 })
    .populate('author')
    .populate('sort')
    .populate('tags')
    .populate('mappointList')
    .populate('coverImages')
    .populate('bangumiList')
    .populate('movieList')
    .populate('gameList')
    .populate('bookList')
    .populate('voteList')
    .populate('eventList')
    .lean()

  if (!post) {
    // 尝试按 _id
    try {
      post = await Post.findOne({ _id: idOrAlias, languageCode, status: 1 })
        .populate('author')
        .populate('sort')
        .populate('tags')
        .populate('mappointList')
        .populate('coverImages')
        .populate('bangumiList')
        .populate('movieList')
        .populate('gameList')
        .populate('bookList')
        .populate('voteList')
        .populate('eventList')
        .lean()
    } catch {
      // 无效 ID 格式
    }
  }
  return post
}
