const mongoose = require('mongoose')

const createLocalizedBaseFields = require('./helpers/localizedBaseFields')

const { Schema } = mongoose

const postsSchema = new Schema(
  {
    ...createLocalizedBaseFields(Schema),
    sourceAlias: {
      type: String,
      default: null
    },
    groupSourceId: {
      type: String,
      required: true,
      index: true
    },
    type: {
      type: Number,
      enum: [1, 2],
      required: true,
      index: true
    },
    title: {
      type: String,
      default: ''
    },
    excerpt: {
      type: String,
      default: ''
    },
    content: {
      type: String,
      default: ''
    },
    alias: {
      type: String,
      required: true,
      trim: true
    },
    date: {
      type: Date,
      default: null
    },
    lastChangDate: {
      type: Date,
      default: null
    },
    status: {
      type: Number,
      enum: [0, 1, 99],
      default: 0,
      index: true
    },
    allowRemark: {
      type: Boolean,
      default: false
    },
    template: {
      type: String,
      default: ''
    },
    code: {
      type: String,
      default: ''
    },
    editorVersion: {
      type: Number,
      default: 5
    },
    coverImages: {
      type: [{ type: Schema.Types.ObjectId, ref: 'attachments' }],
      default: []
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'authors',
      default: null
    },
    sort: {
      type: Schema.Types.ObjectId,
      ref: 'sorts',
      default: null
    },
    tags: {
      type: [{ type: Schema.Types.ObjectId, ref: 'tags' }],
      default: []
    },
    mappointList: {
      type: [{ type: Schema.Types.ObjectId, ref: 'mappoints' }],
      default: []
    },
    bangumiList: {
      type: [{ type: Schema.Types.ObjectId, ref: 'bangumis' }],
      default: []
    },
    movieList: {
      type: [{ type: Schema.Types.ObjectId, ref: 'movies' }],
      default: []
    },
    gameList: {
      type: [{ type: Schema.Types.ObjectId, ref: 'games' }],
      default: []
    },
    bookList: {
      type: [{ type: Schema.Types.ObjectId, ref: 'books' }],
      default: []
    },
    postList: {
      type: [{ type: Schema.Types.ObjectId, ref: 'posts' }],
      default: []
    },
    tweetList: {
      type: [{ type: Schema.Types.ObjectId, ref: 'posts' }],
      default: []
    },
    eventList: {
      type: [{ type: Schema.Types.ObjectId, ref: 'events' }],
      default: []
    },
    voteList: {
      type: [{ type: Schema.Types.ObjectId, ref: 'votes' }],
      default: []
    },
    seriesSortList: {
      type: [{ type: Schema.Types.ObjectId, ref: 'sorts' }],
      default: []
    },
    contentBangumiList: {
      type: [{ type: Schema.Types.ObjectId, ref: 'bangumis' }],
      default: []
    },
    contentMovieList: {
      type: [{ type: Schema.Types.ObjectId, ref: 'movies' }],
      default: []
    },
    contentGameList: {
      type: [{ type: Schema.Types.ObjectId, ref: 'games' }],
      default: []
    },
    contentBookList: {
      type: [{ type: Schema.Types.ObjectId, ref: 'books' }],
      default: []
    },
    contentPostList: {
      type: [{ type: Schema.Types.ObjectId, ref: 'posts' }],
      default: []
    },
    contentTweetList: {
      type: [{ type: Schema.Types.ObjectId, ref: 'posts' }],
      default: []
    },
    contentEventList: {
      type: [{ type: Schema.Types.ObjectId, ref: 'events' }],
      default: []
    },
    contentVoteList: {
      type: [{ type: Schema.Types.ObjectId, ref: 'votes' }],
      default: []
    },
    contentSeriesSortList: {
      type: [{ type: Schema.Types.ObjectId, ref: 'sorts' }],
      default: []
    },
    importMeta: {
      type: Schema.Types.Mixed,
      default: null
    },
    publishMeta: {
      type: Schema.Types.Mixed,
      default: null
    },
    validationState: {
      type: Schema.Types.Mixed,
      default: null
    }
  },
  { timestamps: true }
)

postsSchema.index({ sourceId: 1, languageCode: 1 }, { unique: true })
postsSchema.index({ groupSourceId: 1, languageCode: 1 })
postsSchema.index({ languageCode: 1, alias: 1 }, { unique: true })
postsSchema.index({ languageCode: 1, type: 1, status: 1, date: -1 })
postsSchema.index({ languageCode: 1, sort: 1, status: 1, date: -1 })
postsSchema.index({ languageCode: 1, tags: 1, status: 1, date: -1 })
postsSchema.index({ languageCode: 1, mappointList: 1, status: 1, date: -1 })

module.exports = mongoose.model('posts', postsSchema)
