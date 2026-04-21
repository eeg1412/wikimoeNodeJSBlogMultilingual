const mongoose = require('mongoose')
const Schema = mongoose.Schema
const {
  SUPPORTED_LANGUAGE_CODES,
  TRANSLATION_STATUS,
  TRANSLATION_STATUS_VALUES,
  POST_STATUS_DRAFT,
  IMPORTABLE_POST_TYPES
} = require('@wikimoe-ml/common/constants')

const posts = new Schema(
  {
    // 原站文章 ID，用于分组与复用
    sourceId: { type: String, required: true, index: true },
    // 原站别名（非唯一，仅记录用）
    sourceAlias: { type: String, default: null },
    // 分组键：默认等于 sourceId
    groupSourceId: { type: String, required: true, index: true },
    languageCode: {
      type: String,
      enum: SUPPORTED_LANGUAGE_CODES,
      required: true,
      index: true
    },
    // 仅允许 1 博文 / 2 推文
    type: {
      type: Number,
      enum: IMPORTABLE_POST_TYPES,
      required: true,
      index: true
    },

    title: { type: String, default: '' },
    excerpt: { type: String, default: '' },
    content: { type: String, default: '' },
    alias: { type: String, default: null, index: true },
    date: { type: Date, default: Date.now, index: true },
    lastChangDate: { type: Date, default: Date.now },

    // 0 草稿 / 1 发布 / 99 回收站
    status: { type: Number, default: POST_STATUS_DRAFT, index: true },
    // 多语言站统一禁用评论
    allowRemark: { type: Boolean, default: false },
    template: { type: String, default: '' },
    code: { type: String, default: '' },
    editorVersion: { type: Number, default: 5 },

    coverImages: [{ type: Schema.ObjectId, ref: 'attachments' }],

    author: {
      type: Schema.Types.ObjectId,
      ref: 'authors',
      default: null,
      index: true
    },
    sort: {
      type: Schema.Types.ObjectId,
      ref: 'sorts',
      default: null,
      index: true
    },
    tags: [{ type: Schema.ObjectId, ref: 'tags', index: true }],
    mappointList: [{ type: Schema.ObjectId, ref: 'mappoints', index: true }],

    // 详情页下方推荐
    bangumiList: [{ type: Schema.ObjectId, ref: 'bangumis' }],
    movieList: [{ type: Schema.ObjectId, ref: 'movies' }],
    gameList: [{ type: Schema.ObjectId, ref: 'games' }],
    bookList: [{ type: Schema.ObjectId, ref: 'books' }],
    postList: [{ type: Schema.ObjectId, ref: 'posts' }],
    tweetList: [{ type: Schema.ObjectId, ref: 'posts' }],
    eventList: [{ type: Schema.ObjectId, ref: 'events' }],
    voteList: [{ type: Schema.ObjectId, ref: 'votes' }],
    seriesSortList: [{ type: String }],

    // 正文内强相关
    contentBangumiList: [{ type: Schema.ObjectId, ref: 'bangumis' }],
    contentMovieList: [{ type: Schema.ObjectId, ref: 'movies' }],
    contentGameList: [{ type: Schema.ObjectId, ref: 'games' }],
    contentBookList: [{ type: Schema.ObjectId, ref: 'books' }],
    contentPostList: [{ type: Schema.ObjectId, ref: 'posts' }],
    contentTweetList: [{ type: Schema.ObjectId, ref: 'posts' }],
    contentEventList: [{ type: Schema.ObjectId, ref: 'events' }],
    contentVoteList: [{ type: Schema.ObjectId, ref: 'votes' }],
    contentSeriesSortList: [{ type: String }],

    // 导入元信息
    importMeta: {
      lastImportJob: {
        type: Schema.Types.ObjectId,
        ref: 'importJobs',
        default: null
      },
      lastImportedAt: { type: Date, default: null }
    },
    // 发布元信息
    publishMeta: {
      publishedAt: { type: Date, default: null },
      lastPublishedBy: {
        type: Schema.Types.ObjectId,
        ref: 'adminUsers',
        default: null
      }
    },
    // 发布校验状态（缓存最近一次校验结果）
    validationState: {
      passed: { type: Boolean, default: false },
      checkedAt: { type: Date, default: null },
      issues: { type: Array, default: [] }
    },

    sourceSnapshot: { type: Schema.Types.Mixed, default: null },
    sourceHash: { type: String, default: '', index: true },
    translationStatus: {
      type: String,
      enum: TRANSLATION_STATUS_VALUES,
      default: TRANSLATION_STATUS.PENDING,
      index: true
    },
    isManualEdited: { type: Boolean, default: false }
  },
  { timestamps: true }
)

posts.index({ sourceId: 1, languageCode: 1 }, { unique: true })
posts.index({ groupSourceId: 1, languageCode: 1 })
posts.index(
  { languageCode: 1, alias: 1 },
  {
    unique: true,
    partialFilterExpression: { alias: { $type: 'string', $ne: '' } }
  }
)
posts.index({ languageCode: 1, type: 1, status: 1, date: -1 })
posts.index({ languageCode: 1, sort: 1, status: 1, date: -1 })
posts.index({ languageCode: 1, tags: 1, status: 1, date: -1 })
posts.index({ languageCode: 1, mappointList: 1, status: 1, date: -1 })

module.exports = mongoose.model('posts', posts)
