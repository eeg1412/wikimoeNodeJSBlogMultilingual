const {
  resolveSourceAssetUrl
} = require('../../../common/utils/sourceAssetResolver')
const {
  resolveContentAssets
} = require('../../services/blog/htmlRenderService')

function mapAttachment(attachment, sourceBlogPublicOrigin) {
  if (!attachment) {
    return null
  }

  return {
    id: String(attachment._id),
    url: resolveSourceAssetUrl(attachment.filepath, sourceBlogPublicOrigin),
    thumbUrl: resolveSourceAssetUrl(
      attachment.thumfor || attachment.filepath,
      sourceBlogPublicOrigin
    ),
    width: attachment.width,
    height: attachment.height,
    mimetype: attachment.mimetype
  }
}

function mapEntityList(list) {
  if (!Array.isArray(list)) {
    return []
  }

  return list.map(function (item) {
    return {
      id: String(item._id),
      title: item.title || item.sortname || item.tagname || '',
      summary: item.summary || item.description || ''
    }
  })
}

function mapPostCard(post, sourceBlogPublicOrigin) {
  const coverImage =
    Array.isArray(post.coverImages) && post.coverImages.length > 0
      ? mapAttachment(post.coverImages[0], sourceBlogPublicOrigin)
      : null

  return {
    id: String(post._id),
    title: post.title || '',
    excerpt: post.excerpt || '',
    alias: post.alias || String(post._id),
    type: post.type,
    typeText: post.type === 2 ? 'Tweet' : 'Post',
    date: post.date,
    coverImage,
    author: post.author
      ? {
          id: String(post.author._id),
          nickname: post.author.nickname || ''
        }
      : null,
    sort: post.sort
      ? {
          id: String(post.sort._id),
          sortname: post.sort.sortname || ''
        }
      : null,
    tags: Array.isArray(post.tags)
      ? post.tags.map(function (tag) {
          return {
            id: String(tag._id),
            tagname: tag.tagname || ''
          }
        })
      : []
  }
}

function mapPostDetail(post, sourceBlogPublicOrigin) {
  return {
    ...mapPostCard(post, sourceBlogPublicOrigin),
    contentHtml: resolveContentAssets(
      post.content || '',
      sourceBlogPublicOrigin
    ),
    excerpt: post.excerpt || '',
    mappointList: mapEntityList(post.mappointList),
    bangumiList: mapEntityList(post.bangumiList),
    movieList: mapEntityList(post.movieList),
    gameList: mapEntityList(post.gameList),
    bookList: mapEntityList(post.bookList),
    eventList: mapEntityList(post.eventList),
    voteList: Array.isArray(post.voteList)
      ? post.voteList.map(function (vote) {
          return {
            id: String(vote._id),
            title: vote.title || '',
            options: Array.isArray(vote.options) ? vote.options : []
          }
        })
      : []
  }
}

function mapPagination(result) {
  const totalPages =
    result.total > 0 ? Math.ceil(result.total / result.limit) : 0

  return {
    page: result.page,
    limit: result.limit,
    total: result.total,
    totalPages
  }
}

module.exports = {
  mapPagination,
  mapPostCard,
  mapPostDetail
}
