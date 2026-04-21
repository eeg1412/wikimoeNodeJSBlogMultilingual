const models = require('../models')

function populateAuthor(query) {
  return query
    .populate({
      path: 'photoAttachment',
      select: 'filepath sourcePath externalUrl attachmentSourceType width height mimetype'
    })
    .populate({
      path: 'coverAttachment',
      select: 'filepath sourcePath externalUrl attachmentSourceType width height mimetype'
    })
}

function populatePost(query, scope = 'detail') {
  const baseSelect =
    'title excerpt alias date status languageCode sourceId groupSourceId translationStatus type'

  query
    .populate({
      path: 'author',
      select:
        'nickname description translationStatus sourceId languageCode photoAttachment coverAttachment',
    })
    .populate({
      path: 'sort',
      select: 'sortname alias description translationStatus sourceId languageCode parent'
    })
    .populate({
      path: 'tags',
      select: 'tagname translationStatus sourceId languageCode lastusetime'
    })
    .populate({
      path: 'mappointList',
      select: 'title summary longitude latitude status translationStatus sourceId languageCode'
    })
    .populate({
      path: 'coverImages',
      select:
        'name description filepath sourcePath externalUrl attachmentSourceType translationStatus width height mimetype thumfor thumWidth thumHeight languageCode'
    })

  const relatedCollections = [
    'bangumiList',
    'movieList',
    'gameList',
    'bookList',
    'eventList',
    'voteList',
    'contentBangumiList',
    'contentMovieList',
    'contentGameList',
    'contentBookList',
    'contentEventList',
    'contentVoteList'
  ]

  for (const relation of relatedCollections) {
    query.populate({
      path: relation,
      select: 'title summary description translationStatus sourceId languageCode status payload options'
    })
  }

  const postRelations = ['postList', 'tweetList', 'contentPostList', 'contentTweetList']
  for (const relation of postRelations) {
    query.populate({
      path: relation,
      select: baseSelect,
      populate: {
        path: 'coverImages',
        select: 'filepath sourcePath externalUrl attachmentSourceType width height thumfor thumWidth thumHeight'
      }
    })
  }

  if (scope === 'detail') {
    query.populate({
      path: 'author',
      populate: [
        { path: 'photoAttachment', select: 'filepath sourcePath externalUrl attachmentSourceType width height mimetype' },
        { path: 'coverAttachment', select: 'filepath sourcePath externalUrl attachmentSourceType width height mimetype' }
      ]
    })
  }

  return query
}

function applyPopulate(query, modelName, options = {}) {
  switch (modelName) {
    case 'authors':
      return populateAuthor(query)
    case 'posts':
      return populatePost(query, options.scope)
    default:
      return query
  }
}

function createCrudUtils(modelName) {
  const model = models[modelName]

  return {
    aggregate(pipeline) {
      return model.aggregate(pipeline)
    },
    countDocuments(filter = {}) {
      return model.countDocuments(filter)
    },
    deleteOne(filter) {
      return model.deleteOne(filter)
    },
    find(filter = {}, projection, options = {}) {
      let query = model.find(filter, projection)
      query = applyPopulate(query, modelName, options)
      if (options.sort) {
        query = query.sort(options.sort)
      }
      if (options.limit) {
        query = query.limit(options.limit)
      }
      if (options.skip) {
        query = query.skip(options.skip)
      }
      return query
    },
    async findOne(filter = {}, projection, options = {}) {
      let query = model.findOne(filter, projection)
      query = applyPopulate(query, modelName, options)
      return query
    },
    async findPage(filter = {}, sort = { updatedAt: -1 }, page = 1, limit = 20, projection, options = {}) {
      let query = model.find(filter, projection).sort(sort)
      query = applyPopulate(query, modelName, options)
      const list = await query.skip((page - 1) * limit).limit(limit)
      const total = await model.countDocuments(filter)
      return { list, total, page, limit }
    },
    model,
    save(payload) {
      return new model(payload).save()
    },
    updateMany(filter, update, options = {}) {
      return model.updateMany(filter, update, options)
    },
    updateOne(filter, update, options = {}) {
      return model.updateOne(filter, update, options)
    },
    upsertOne(filter, update, options = {}) {
      return model.findOneAndUpdate(
        filter,
        { $set: update },
        {
          new: true,
          setDefaultsOnInsert: true,
          upsert: true,
          ...options
        }
      )
    }
  }
}

const utils = Object.keys(models).reduce((result, modelName) => {
  result[modelName] = createCrudUtils(modelName)
  return result
}, {})

module.exports = utils