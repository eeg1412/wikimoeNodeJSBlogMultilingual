const mongoose = require('mongoose')
const { Posts } = require('../../../mongodb/models')
const { badRequest, notFound } = require('../../../utils/errors')

/**
 * GET /api/admin/post/:id 或 ?id=xxx
 */
module.exports = async function getPostApi(req, res) {
  const id = req.params.id || req.query.id
  if (!mongoose.isValidObjectId(id)) {
    throw badRequest('非法的文章 ID')
  }
  const post = await Posts.findById(id)
    .populate('author')
    .populate('sort')
    .populate('tags')
    .populate('mappointList')
    .populate('coverImages')
    .populate('bangumiList movieList gameList bookList eventList voteList')
    .populate(
      'contentBangumiList contentMovieList contentGameList contentBookList contentEventList contentVoteList'
    )
    .populate({
      path: 'postList',
      select: '_id title status languageCode translationStatus alias'
    })
    .populate({
      path: 'tweetList',
      select: '_id title status languageCode translationStatus alias'
    })
    .populate({
      path: 'contentPostList',
      select: '_id title status languageCode translationStatus alias'
    })
    .populate({
      path: 'contentTweetList',
      select: '_id title status languageCode translationStatus alias'
    })
    .lean()
  if (!post) throw notFound('文章不存在')
  res.json({ data: post })
}
