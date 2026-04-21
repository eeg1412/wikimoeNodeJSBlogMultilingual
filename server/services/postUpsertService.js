const { Posts } = require('../mongodb/models')
const {
  TRANSLATION_STATUS,
  POST_STATUS_DRAFT
} = require('@wikimoe-ml/common/constants')
const { stableObjectHash } = require('@wikimoe-ml/common/utils/hash')
const { AppError } = require('../utils/errors')

/**
 * 依据 (sourceId, languageCode) 查询现有译文（包括 stub）
 */
async function findExistingTranslation(sourceId, languageCode) {
  return Posts.findOne({ sourceId, languageCode }).exec()
}

/**
 * 生成文章 sourceSnapshot（稳定可哈希），仅包含原站正文相关字段
 */
function buildPostSnapshot(postCore, deps) {
  return {
    sourceId: postCore.sourceId,
    type: postCore.type,
    title: postCore.title,
    excerpt: postCore.excerpt,
    content: postCore.content,
    alias: postCore.alias,
    template: postCore.template,
    code: postCore.code,
    editorVersion: postCore.editorVersion,
    seriesSortList: postCore.seriesSortList || [],
    contentSeriesSortList: postCore.contentSeriesSortList || [],
    authorSourceId: deps.authorSourceId || null,
    sortSourceId: deps.sortSourceId || null,
    tagSourceIds: (deps.tagSourceIds || []).slice().sort(),
    mappointSourceIds: (deps.mappointSourceIds || []).slice().sort(),
    coverAttachmentSourceIds: (deps.coverAttachmentSourceIds || []).slice(),
    bangumiSourceIds: (deps.bangumiSourceIds || []).slice().sort(),
    movieSourceIds: (deps.movieSourceIds || []).slice().sort(),
    gameSourceIds: (deps.gameSourceIds || []).slice().sort(),
    bookSourceIds: (deps.bookSourceIds || []).slice().sort(),
    eventSourceIds: (deps.eventSourceIds || []).slice().sort(),
    voteSourceIds: (deps.voteSourceIds || []).slice().sort(),
    relatedPostSourceIds: (deps.relatedPostSourceIds || []).slice().sort(),
    relatedTweetSourceIds: (deps.relatedTweetSourceIds || []).slice().sort(),
    contentBangumiSourceIds: (deps.contentBangumiSourceIds || [])
      .slice()
      .sort(),
    contentMovieSourceIds: (deps.contentMovieSourceIds || []).slice().sort(),
    contentGameSourceIds: (deps.contentGameSourceIds || []).slice().sort(),
    contentBookSourceIds: (deps.contentBookSourceIds || []).slice().sort(),
    contentEventSourceIds: (deps.contentEventSourceIds || []).slice().sort(),
    contentVoteSourceIds: (deps.contentVoteSourceIds || []).slice().sort(),
    contentPostSourceIds: (deps.contentPostSourceIds || []).slice().sort(),
    contentTweetSourceIds: (deps.contentTweetSourceIds || []).slice().sort(),
    date: postCore.date || null,
    lastChangDate: postCore.lastChangDate || null
  }
}

/**
 * 创建或覆盖一篇译文。
 *   - existing 不存在：直接新建（PENDING）
 *   - existing 存在但是 STUB：视为"升级 stub 为完整记录"，不需要 confirmOverwrite
 *   - existing 存在且非 STUB：
 *       confirmOverwrite === true：覆盖并重置为 DRAFT + PENDING + 清空 validationState
 *       confirmOverwrite !== true：抛出 409 冲突
 *
 * @param {object} params
 * @param {object} params.postCore     - 原站文章基础字段
 * @param {object} params.deps         - 已经 upsert 后的关联实体 ObjectId 结构
 * @param {object} params.depsSourceIds - 同上，但使用原站 sourceId（用于生成 snapshot）
 * @param {string} params.languageCode
 * @param {boolean} params.confirmOverwrite
 * @param {string} params.importJobId
 */
async function createOrOverwritePost(params) {
  const {
    postCore,
    deps,
    depsSourceIds,
    languageCode,
    confirmOverwrite,
    importJobId
  } = params

  const snapshot = buildPostSnapshot(postCore, depsSourceIds)
  const hash = stableObjectHash(snapshot)

  const existing = await findExistingTranslation(
    postCore.sourceId,
    languageCode
  )

  const isOverwrite =
    !!existing && existing.translationStatus !== TRANSLATION_STATUS.STUB

  if (isOverwrite && !confirmOverwrite) {
    throw new AppError('译文已存在，如需覆盖请确认', 409, 'POST_EXISTS', {
      postId: String(existing._id),
      translationStatus: existing.translationStatus,
      status: existing.status
    })
  }

  const baseDoc = {
    sourceId: postCore.sourceId,
    sourceAlias: postCore.sourceAlias || null,
    groupSourceId: postCore.sourceId,
    languageCode,
    type: postCore.type,
    title: '',
    excerpt: '',
    content: '',
    alias: null,
    date: postCore.date || Date.now(),
    lastChangDate: postCore.lastChangDate || Date.now(),
    status: POST_STATUS_DRAFT,
    allowRemark: false,
    template: postCore.template || '',
    code: postCore.code || '',
    editorVersion: postCore.editorVersion || 5,
    coverImages: deps.coverAttachmentIds || [],
    author: deps.authorId || null,
    sort: deps.sortId || null,
    tags: deps.tagIds || [],
    mappointList: deps.mappointIds || [],
    bangumiList: deps.bangumiIds || [],
    movieList: deps.movieIds || [],
    gameList: deps.gameIds || [],
    bookList: deps.bookIds || [],
    eventList: deps.eventIds || [],
    voteList: deps.voteIds || [],
    postList: deps.relatedPostIds || [],
    tweetList: deps.relatedTweetIds || [],
    seriesSortList: postCore.seriesSortList || [],
    contentBangumiList: deps.contentBangumiIds || [],
    contentMovieList: deps.contentMovieIds || [],
    contentGameList: deps.contentGameIds || [],
    contentBookList: deps.contentBookIds || [],
    contentEventList: deps.contentEventIds || [],
    contentVoteList: deps.contentVoteIds || [],
    contentPostList: deps.contentPostIds || [],
    contentTweetList: deps.contentTweetIds || [],
    contentSeriesSortList: postCore.contentSeriesSortList || [],
    importMeta: {
      lastImportJob: importJobId || null,
      lastImportedAt: new Date()
    },
    validationState: {
      passed: false,
      checkedAt: null,
      issues: []
    },
    sourceSnapshot: snapshot,
    sourceHash: hash,
    translationStatus: TRANSLATION_STATUS.PENDING,
    isManualEdited: false
  }

  if (!existing) {
    const doc = new Posts(baseDoc)
    await doc.save()
    return { doc, mode: 'created' }
  }

  // 升级 stub 或覆盖现有
  const wasStub = existing.translationStatus === TRANSLATION_STATUS.STUB
  Object.assign(existing, baseDoc)
  // 保留 createdAt 等系统字段；重置发布相关
  existing.publishMeta = {
    publishedAt: null,
    lastPublishedBy: null
  }
  await existing.save()
  return { doc: existing, mode: wasStub ? 'stub-upgraded' : 'overwritten' }
}

module.exports = {
  findExistingTranslation,
  buildPostSnapshot,
  createOrOverwritePost
}
