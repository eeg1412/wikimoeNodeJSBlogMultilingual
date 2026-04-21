const { Posts } = require('../../mongodb/models')
const { POST_STATUS_PUBLISHED } = require('@wikimoe-ml/common/constants')
const { parseLang, isObjectId } = require('./_helpers')
const { serializeAttachment, serializeAttachmentList } = require('./_serialize')
const { badRequest, notFound } = require('../../utils/errors')

// 关联文章 / 推文 / 实体 精简展示字段
const LINKED_POST_FIELDS = '_id title alias type date languageCode coverImages'
const LINKED_ENTITY_FIELDS =
  '_id title name sortname tagname summary longitude latitude'

module.exports = async function getPostDetail(req, res) {
  const lang = parseLang(req)
  const rawId = String(req.query.id || '').trim()
  if (!rawId) {
    throw badRequest('id 不能为空')
  }
  if (rawId.length > 64) {
    throw badRequest('id 参数错误')
  }

  const filter = {
    languageCode: lang,
    status: POST_STATUS_PUBLISHED
  }
  if (isObjectId(rawId)) {
    filter._id = rawId
  } else {
    filter.alias = rawId
  }

  const doc = await Posts.findOne(filter)
    .populate('coverImages')
    .populate({
      path: 'author',
      select: 'nickname description photoAttachment coverAttachment',
      populate: [{ path: 'photoAttachment' }, { path: 'coverAttachment' }]
    })
    .populate('sort', 'sortname alias description')
    .populate('tags', 'tagname')
    .populate('mappointList', 'title summary longitude latitude zIndex')
    .populate('bangumiList')
    .populate('movieList')
    .populate('gameList')
    .populate('bookList')
    .populate('eventList')
    .populate({
      path: 'voteList',
      select: '_id title options maxSelect showResultAfter endTime status'
    })
    .populate({
      path: 'postList',
      select: LINKED_POST_FIELDS,
      populate: { path: 'coverImages' }
    })
    .populate({
      path: 'tweetList',
      select: LINKED_POST_FIELDS,
      populate: { path: 'coverImages' }
    })
    .populate('contentBangumiList')
    .populate('contentMovieList')
    .populate('contentGameList')
    .populate('contentBookList')
    .populate('contentEventList')
    .populate({
      path: 'contentVoteList',
      select: '_id title options maxSelect showResultAfter endTime status'
    })
    .populate({
      path: 'contentPostList',
      select: LINKED_POST_FIELDS,
      populate: { path: 'coverImages' }
    })
    .populate({
      path: 'contentTweetList',
      select: LINKED_POST_FIELDS,
      populate: { path: 'coverImages' }
    })
    .lean()

  if (!doc) {
    throw notFound('文章不存在')
  }

  // hreflang alternates：同 groupSourceId 下已发布的其他语言
  const altDocs = await Posts.find({
    groupSourceId: doc.groupSourceId,
    status: POST_STATUS_PUBLISHED
  })
    .select('_id languageCode alias sourceId')
    .lean()
  const alternates = altDocs.map(a => ({
    languageCode: a.languageCode,
    _id: a._id,
    alias: a.alias,
    isCurrent: String(a._id) === String(doc._id)
  }))

  // 序列化
  const serializeLinkedPost = p =>
    p
      ? {
          _id: p._id,
          title: p.title,
          alias: p.alias,
          type: p.type,
          date: p.date,
          languageCode: p.languageCode,
          coverImages: serializeAttachmentList(p.coverImages)
        }
      : null

  const serializeLinkedPostList = list =>
    Array.isArray(list) ? list.map(serializeLinkedPost).filter(Boolean) : []

  const serializedAuthor = doc.author
    ? {
        _id: doc.author._id,
        nickname: doc.author.nickname,
        description: doc.author.description,
        photo: serializeAttachment(doc.author.photoAttachment),
        cover: serializeAttachment(doc.author.coverAttachment)
      }
    : null

  const serializeVote = v =>
    v
      ? {
          _id: v._id,
          title: v.title,
          maxSelect: v.maxSelect,
          showResultAfter: v.showResultAfter,
          endTime: v.endTime,
          status: v.status,
          options: Array.isArray(v.options)
            ? v.options.map(op => ({
                sourceOptionId: op.sourceOptionId,
                title: op.title,
                sort: op.sort
              }))
            : []
        }
      : null

  const result = {
    _id: doc._id,
    sourceId: doc.sourceId,
    groupSourceId: doc.groupSourceId,
    languageCode: doc.languageCode,
    type: doc.type,
    title: doc.title,
    excerpt: doc.excerpt,
    content: doc.content,
    alias: doc.alias,
    date: doc.date,
    lastChangDate: doc.lastChangDate,
    template: doc.template,
    editorVersion: doc.editorVersion,
    coverImages: serializeAttachmentList(doc.coverImages),
    author: serializedAuthor,
    sort: doc.sort
      ? {
          _id: doc.sort._id,
          sortname: doc.sort.sortname,
          alias: doc.sort.alias,
          description: doc.sort.description
        }
      : null,
    tags: Array.isArray(doc.tags)
      ? doc.tags.map(t => ({ _id: t._id, tagname: t.tagname }))
      : [],
    mappointList: Array.isArray(doc.mappointList)
      ? doc.mappointList.map(m => ({
          _id: m._id,
          title: m.title,
          summary: m.summary,
          longitude: m.longitude,
          latitude: m.latitude,
          zIndex: m.zIndex
        }))
      : [],
    bangumiList: doc.bangumiList || [],
    movieList: doc.movieList || [],
    gameList: doc.gameList || [],
    bookList: doc.bookList || [],
    eventList: doc.eventList || [],
    voteList: Array.isArray(doc.voteList)
      ? doc.voteList.map(serializeVote).filter(Boolean)
      : [],
    postList: serializeLinkedPostList(doc.postList),
    tweetList: serializeLinkedPostList(doc.tweetList),
    contentBangumiList: doc.contentBangumiList || [],
    contentMovieList: doc.contentMovieList || [],
    contentGameList: doc.contentGameList || [],
    contentBookList: doc.contentBookList || [],
    contentEventList: doc.contentEventList || [],
    contentVoteList: Array.isArray(doc.contentVoteList)
      ? doc.contentVoteList.map(serializeVote).filter(Boolean)
      : [],
    contentPostList: serializeLinkedPostList(doc.contentPostList),
    contentTweetList: serializeLinkedPostList(doc.contentTweetList),
    alternates
  }

  res.json({ data: result })
}
