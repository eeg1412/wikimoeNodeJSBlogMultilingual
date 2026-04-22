import mongoose from 'mongoose'
import { TRANSLATION_STATUS } from '../../../common/constants/index.js'

const translationStatusEnum = Object.values(TRANSLATION_STATUS)

const postSchema = new mongoose.Schema(
  {
    sourceId: { type: String, required: true },
    sourceAlias: { type: String, default: '' },
    /** 固定等于 sourceId，用于分组 */
    groupSourceId: { type: String, required: true },
    languageCode: { type: String, required: true, enum: ['en', 'jp', 'tw'] },
    /** 只允许 1 (博文) 或 2 (推文) */
    type: { type: Number, required: true, enum: [1, 2] },
    title: { type: String, default: '' },
    excerpt: { type: String, default: '' },
    content: { type: String, default: '' },
    alias: { type: String, default: '' },
    date: { type: Date, default: null },
    lastChangDate: { type: Date, default: null },
    /** 0 草稿 | 1 发布 | 99 回收站 */
    status: { type: Number, default: 0, enum: [0, 1, 99] },
    /** 固定 false，不允许写入评论 */
    allowRemark: { type: Boolean, default: false },
    template: { type: String, default: '' },
    code: { type: String, default: '' },
    editorVersion: { type: Number, default: 5 },
    coverImages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Attachment' }],
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Author',
      default: null
    },
    sort: { type: mongoose.Schema.Types.ObjectId, ref: 'Sort', default: null },
    tags: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag' }],
    mappointList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Mappoint' }],
    bangumiList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Bangumi' }],
    movieList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Movie' }],
    gameList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Game' }],
    bookList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book' }],
    postList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
    tweetList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
    eventList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Event' }],
    voteList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vote' }],
    seriesSortList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Sort' }],
    contentBangumiList: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Bangumi' }
    ],
    contentMovieList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Movie' }],
    contentGameList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Game' }],
    contentBookList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Book' }],
    contentPostList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
    contentTweetList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
    contentEventList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Event' }],
    contentVoteList: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Vote' }],
    contentSeriesSortList: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Sort' }
    ],
    importMeta: { type: Object, default: null },
    publishMeta: {
      publishedAt: { type: Date, default: null }
    },
    /** 发布校验状态快照 */
    validationState: { type: Object, default: null },
    sourceSnapshot: { type: Object, default: null },
    sourceHash: { type: String, default: '' },
    translationStatus: {
      type: String,
      enum: translationStatusEnum,
      default: TRANSLATION_STATUS.PENDING
    },
    isManualEdited: { type: Boolean, default: false }
  },
  {
    timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' }
  }
)

postSchema.index({ sourceId: 1, languageCode: 1 }, { unique: true })
postSchema.index({ groupSourceId: 1, languageCode: 1 })
postSchema.index(
  { languageCode: 1, alias: 1 },
  {
    unique: true,
    partialFilterExpression: { alias: { $type: 'string', $gt: '' } }
  }
)
postSchema.index({ languageCode: 1, type: 1, status: 1, date: -1 })
postSchema.index({ languageCode: 1, sort: 1, status: 1, date: -1 })
postSchema.index({ languageCode: 1, tags: 1, status: 1, date: -1 })
postSchema.index({ languageCode: 1, mappointList: 1, status: 1, date: -1 })

export default mongoose.model('Post', postSchema)
