const mongoose = require('mongoose')
const {
  ALLOWED_POST_TYPES,
  ATTACHMENT_SOURCE_TYPE,
  POST_STATUS,
  SUPPORTED_LANGUAGE_CODES,
  TRANSLATION_STATUS_LIST
} = require('../../../common/constants')

const { Schema } = mongoose

function createModel(name, schema) {
  return mongoose.models[name] || mongoose.model(name, schema)
}

function withLocalizedBaseFields(fields) {
  return {
    sourceId: { type: String, default: null, index: true },
    languageCode: {
      type: String,
      enum: SUPPORTED_LANGUAGE_CODES,
      required: true,
      index: true
    },
    sourceSnapshot: { type: Schema.Types.Mixed, default: {} },
    sourceHash: { type: String, default: '' },
    translationStatus: {
      type: String,
      enum: TRANSLATION_STATUS_LIST,
      default: 'pending',
      index: true
    },
    isManualEdited: { type: Boolean, default: false },
    ...fields
  }
}

const adminUserSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    nickname: { type: String, required: true },
    role: { type: String, default: 'superadmin', index: true },
    disabled: { type: Boolean, default: false, index: true },
    pwversion: { type: Number, default: 0, index: true },
    IP: { type: String, default: '' },
    ipInfo: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
)

const attachmentSchema = new Schema(
  withLocalizedBaseFields({
    attachmentSourceType: {
      type: String,
      enum: Object.values(ATTACHMENT_SOURCE_TYPE),
      required: true,
      index: true
    },
    attachmentGroupKey: { type: String, default: null, index: true },
    sourcePath: { type: String, default: null },
    sourcePathHash: { type: String, default: null, index: true },
    externalUrl: { type: String, default: null },
    externalUrlHash: { type: String, default: null, index: true },
    filename: { type: String, default: '' },
    filepath: { type: String, default: '' },
    storagePath: { type: String, default: '' },
    name: { type: String, default: '' },
    description: { type: String, default: '' },
    filesize: { type: Number, default: 0 },
    fileHash: { type: String, default: '' },
    width: { type: Number, default: null },
    height: { type: Number, default: null },
    mimetype: { type: String, default: '' },
    thumfor: { type: String, default: '' },
    thumWidth: { type: Number, default: null },
    thumHeight: { type: Number, default: null },
    albumSourceId: { type: String, default: null },
    is360Panorama: { type: Boolean, default: false },
    derivedFromSourceId: { type: String, default: null },
    importOrigin: { type: String, default: 'sourceAttachment' }
  }),
  { timestamps: true }
)
attachmentSchema.index(
  { sourceId: 1, languageCode: 1, attachmentSourceType: 1 },
  {
    unique: true,
    partialFilterExpression: { sourceId: { $type: 'string' } }
  }
)
attachmentSchema.index(
  { sourcePathHash: 1, languageCode: 1, attachmentSourceType: 1 },
  {
    unique: true,
    partialFilterExpression: { sourcePathHash: { $type: 'string' } }
  }
)
attachmentSchema.index(
  { externalUrlHash: 1, languageCode: 1, attachmentSourceType: 1 },
  {
    unique: true,
    partialFilterExpression: { externalUrlHash: { $type: 'string' } }
  }
)
attachmentSchema.index(
  { attachmentGroupKey: 1, languageCode: 1, attachmentSourceType: 1 },
  {
    unique: true,
    partialFilterExpression: { attachmentGroupKey: { $type: 'string' } }
  }
)

const authorsSchema = new Schema(
  withLocalizedBaseFields({
    nickname: { type: String, default: '' },
    description: { type: String, default: '' },
    photoAttachment: { type: Schema.Types.ObjectId, ref: 'attachments', default: null },
    coverAttachment: { type: Schema.Types.ObjectId, ref: 'attachments', default: null }
  }),
  { timestamps: true }
)
authorsSchema.index({ sourceId: 1, languageCode: 1 }, { unique: true })

const sortsSchema = new Schema(
  withLocalizedBaseFields({
    sortname: { type: String, default: '' },
    alias: { type: String, default: '' },
    description: { type: String, default: '' },
    template: { type: String, default: '' },
    taxis: { type: Number, default: 0, index: true },
    parentSourceId: { type: String, default: null },
    parent: { type: Schema.Types.ObjectId, ref: 'sorts', default: null, index: true }
  }),
  { timestamps: true }
)
sortsSchema.index({ sourceId: 1, languageCode: 1 }, { unique: true })
sortsSchema.index(
  { languageCode: 1, alias: 1 },
  {
    unique: true,
    partialFilterExpression: { alias: { $gt: '' } }
  }
)

const tagsSchema = new Schema(
  withLocalizedBaseFields({
    tagname: { type: String, default: '' },
    lastusetime: { type: Date, default: Date.now }
  }),
  { timestamps: true }
)
tagsSchema.index({ sourceId: 1, languageCode: 1 }, { unique: true })

const mappointsSchema = new Schema(
  withLocalizedBaseFields({
    title: { type: String, default: '' },
    summary: { type: String, default: '' },
    longitude: { type: Number, default: 0 },
    latitude: { type: Number, default: 0 },
    zIndex: { type: Number, default: 0 },
    status: { type: Number, default: 1, index: true }
  }),
  { timestamps: true }
)
mappointsSchema.index({ sourceId: 1, languageCode: 1 }, { unique: true })

function createRelatedEntitySchema() {
  const schema = new Schema(
    withLocalizedBaseFields({
      title: { type: String, default: '' },
      summary: { type: String, default: '' },
      description: { type: String, default: '' },
      status: { type: Number, default: 1, index: true },
      payload: { type: Schema.Types.Mixed, default: {} }
    }),
    { timestamps: true }
  )
  schema.index({ sourceId: 1, languageCode: 1 }, { unique: true })
  return schema
}

const voteOptionSchema = new Schema(
  {
    sourceOptionId: { type: String, default: '' },
    title: { type: String, default: '' }
  },
  { _id: false }
)

const votesSchema = new Schema(
  withLocalizedBaseFields({
    title: { type: String, default: '' },
    status: { type: Number, default: 1, index: true },
    maxSelect: { type: Number, default: 1 },
    showResultAfter: { type: Boolean, default: true },
    endTime: { type: Date, default: null },
    options: { type: [voteOptionSchema], default: [] },
    payload: { type: Schema.Types.Mixed, default: {} }
  }),
  { timestamps: true }
)
votesSchema.index({ sourceId: 1, languageCode: 1 }, { unique: true })

const postsSchema = new Schema(
  {
    sourceId: { type: String, required: true },
    sourceAlias: { type: String, default: '' },
    groupSourceId: { type: String, required: true, index: true },
    languageCode: {
      type: String,
      enum: SUPPORTED_LANGUAGE_CODES,
      required: true,
      index: true
    },
    type: { type: Number, enum: ALLOWED_POST_TYPES, required: true, index: true },
    title: { type: String, default: '', index: true },
    excerpt: { type: String, default: '' },
    content: { type: String, default: '' },
    alias: { type: String, default: '', index: true },
    date: { type: Date, default: Date.now, index: true },
    lastChangDate: { type: Date, default: Date.now },
    status: {
      type: Number,
      enum: Object.values(POST_STATUS),
      default: POST_STATUS.DRAFT,
      index: true
    },
    allowRemark: { type: Boolean, default: false },
    template: { type: String, default: '' },
    code: { type: String, default: '' },
    editorVersion: { type: Number, default: 5 },
    author: { type: Schema.Types.ObjectId, ref: 'authors', default: null, index: true },
    sort: { type: Schema.Types.ObjectId, ref: 'sorts', default: null, index: true },
    tags: [{ type: Schema.Types.ObjectId, ref: 'tags', index: true }],
    mappointList: [{ type: Schema.Types.ObjectId, ref: 'mappoints', index: true }],
    coverImages: [{ type: Schema.Types.ObjectId, ref: 'attachments' }],
    bangumiList: [{ type: Schema.Types.ObjectId, ref: 'bangumis', index: true }],
    movieList: [{ type: Schema.Types.ObjectId, ref: 'movies', index: true }],
    gameList: [{ type: Schema.Types.ObjectId, ref: 'games', index: true }],
    bookList: [{ type: Schema.Types.ObjectId, ref: 'books', index: true }],
    postList: [{ type: Schema.Types.ObjectId, ref: 'posts', index: true }],
    tweetList: [{ type: Schema.Types.ObjectId, ref: 'posts', index: true }],
    eventList: [{ type: Schema.Types.ObjectId, ref: 'events', index: true }],
    voteList: [{ type: Schema.Types.ObjectId, ref: 'votes', index: true }],
    seriesSortList: [{ type: Schema.Types.Mixed, default: [] }],
    contentBangumiList: [{ type: Schema.Types.ObjectId, ref: 'bangumis', index: true }],
    contentMovieList: [{ type: Schema.Types.ObjectId, ref: 'movies', index: true }],
    contentGameList: [{ type: Schema.Types.ObjectId, ref: 'games', index: true }],
    contentBookList: [{ type: Schema.Types.ObjectId, ref: 'books', index: true }],
    contentPostList: [{ type: Schema.Types.ObjectId, ref: 'posts', index: true }],
    contentTweetList: [{ type: Schema.Types.ObjectId, ref: 'posts', index: true }],
    contentEventList: [{ type: Schema.Types.ObjectId, ref: 'events', index: true }],
    contentVoteList: [{ type: Schema.Types.ObjectId, ref: 'votes', index: true }],
    contentSeriesSortList: [{ type: Schema.Types.Mixed, default: [] }],
    importMeta: { type: Schema.Types.Mixed, default: {} },
    publishMeta: { type: Schema.Types.Mixed, default: {} },
    validationState: { type: Schema.Types.Mixed, default: {} },
    sourceSnapshot: { type: Schema.Types.Mixed, default: {} },
    sourceHash: { type: String, default: '' },
    translationStatus: {
      type: String,
      enum: TRANSLATION_STATUS_LIST,
      default: 'pending',
      index: true
    },
    isManualEdited: { type: Boolean, default: false }
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

const importJobsSchema = new Schema(
  {
    sourceIdentifier: { type: String, required: true },
    sourceResolvedId: { type: String, default: '' },
    languageCode: { type: String, enum: SUPPORTED_LANGUAGE_CODES, required: true },
    operatorAdminId: { type: Schema.Types.ObjectId, ref: 'adminUsers', default: null },
    status: { type: String, default: 'running', index: true },
    stage: { type: String, default: 'resolveSource' },
    sourcePayload: { type: Schema.Types.Mixed, default: {} },
    sourcePayloadHash: { type: String, default: '' },
    resultPostId: { type: Schema.Types.ObjectId, ref: 'posts', default: null },
    warnings: { type: [String], default: [] },
    errors: { type: [String], default: [] },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date, default: null }
  },
  { timestamps: true }
)
importJobsSchema.index({ sourceResolvedId: 1, languageCode: 1, status: 1 })

const translationMemoriesSchema = new Schema(
  {
    sourceTextHash: { type: String, required: true },
    sourceText: { type: String, default: '' },
    targetLanguageCode: { type: String, enum: SUPPORTED_LANGUAGE_CODES, required: true },
    fieldKind: { type: String, required: true },
    translatedText: { type: String, default: '' },
    provider: { type: String, default: 'google-genai' },
    model: { type: String, default: '' },
    approved: { type: Boolean, default: false }
  },
  { timestamps: true }
)
translationMemoriesSchema.index(
  { sourceTextHash: 1, targetLanguageCode: 1, fieldKind: 1 },
  { unique: true }
)

const aiTranslationLogsSchema = new Schema(
  {
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    fieldPath: { type: String, required: true },
    languageCode: { type: String, enum: SUPPORTED_LANGUAGE_CODES, required: true },
    sourceHash: { type: String, default: '' },
    requestPayload: { type: Schema.Types.Mixed, default: {} },
    responsePayload: { type: Schema.Types.Mixed, default: {} },
    normalizedResult: { type: Schema.Types.Mixed, default: {} },
    provider: { type: String, default: 'google-genai' },
    model: { type: String, default: '' },
    promptVersion: { type: String, default: 'v1' },
    tokenUsage: { type: Schema.Types.Mixed, default: {} },
    success: { type: Boolean, default: false },
    errorMessage: { type: String, default: '' },
    operatorAdminId: { type: Schema.Types.ObjectId, ref: 'adminUsers', default: null }
  },
  { timestamps: true }
)

const optionsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Schema.Types.Mixed, default: null }
  },
  { timestamps: true }
)

const models = {
  adminUsers: createModel('adminUsers', adminUserSchema),
  aiTranslationLogs: createModel('aiTranslationLogs', aiTranslationLogsSchema),
  attachments: createModel('attachments', attachmentSchema),
  authors: createModel('authors', authorsSchema),
  bangumis: createModel('bangumis', createRelatedEntitySchema()),
  books: createModel('books', createRelatedEntitySchema()),
  events: createModel('events', createRelatedEntitySchema()),
  games: createModel('games', createRelatedEntitySchema()),
  importJobs: createModel('importJobs', importJobsSchema),
  mappoints: createModel('mappoints', mappointsSchema),
  movies: createModel('movies', createRelatedEntitySchema()),
  options: createModel('options', optionsSchema),
  posts: createModel('posts', postsSchema),
  sorts: createModel('sorts', sortsSchema),
  tags: createModel('tags', tagsSchema),
  translationMemories: createModel('translationMemories', translationMemoriesSchema),
  votes: createModel('votes', votesSchema)
}

module.exports = models