const AsyncLock = require('async-lock')
const logger = require('log4js').getLogger('import')

const { ImportJobs } = require('../mongodb/models')
const {
  IMPORT_JOB_STATUS,
  IMPORT_JOB_STAGE
} = require('@wikimoe-ml/common/constants')
const { stableObjectHash } = require('@wikimoe-ml/common/utils/hash')

const { fetchPostDetail } = require('./sourceBlogClient')
const { extractPostDependencies } = require('./sourceDataExtractor')
const shared = require('./sharedEntityUpsertService')
const { createOrOverwritePost } = require('./postUpsertService')
const { AppError } = require('../utils/errors')

const lock = new AsyncLock({ timeout: 60000 })

/**
 * 执行文章导入流程。
 *
 * 流程：
 *  1. 请求原站 detail 解析出 resolvedId
 *  2. 以 "resolvedId:languageCode" 为 key 上锁，保证并发幂等
 *  3. 依赖实体 upsert（共享实体、封面附件、HTML 媒体附件、关联 stub）
 *  4. 文章 upsert（新建或覆盖，覆盖需要 confirmOverwrite）
 *  5. 记录 importJobs 状态
 *
 * @param {object} params
 * @param {string} params.sourceIdentifier
 * @param {string} params.languageCode
 * @param {boolean} [params.confirmOverwrite]
 * @param {string} [params.operatorAdminId]
 */
async function importPost(params) {
  const { sourceIdentifier, languageCode } = params
  const confirmOverwrite = !!params.confirmOverwrite
  const operatorAdminId = params.operatorAdminId || null

  // 1. 请求原站（放在锁外，避免外部 IO 占用锁时间）
  const { post, resolvedId } = await fetchPostDetail(sourceIdentifier)

  const lockKey = resolvedId + ':' + languageCode

  return lock.acquire(lockKey, async function () {
    return runImportJob({
      post,
      resolvedId,
      sourceIdentifier,
      languageCode,
      confirmOverwrite,
      operatorAdminId
    })
  })
}

async function runImportJob(ctx) {
  const {
    post,
    resolvedId,
    sourceIdentifier,
    languageCode,
    confirmOverwrite,
    operatorAdminId
  } = ctx

  const warnings = []
  const sourcePayloadHash = stableObjectHash({
    id: post._id,
    lastChangDate: post.lastChangDate,
    updatedAt: post.updatedAt
  })

  const job = new ImportJobs({
    sourceIdentifier,
    sourceResolvedId: resolvedId,
    languageCode,
    operatorAdminId,
    status: IMPORT_JOB_STATUS.RUNNING,
    stage: IMPORT_JOB_STAGE.RESOLVE_SOURCE,
    sourcePayload: post,
    sourcePayloadHash,
    startedAt: new Date()
  })
  await job.save()

  try {
    // 2. 解析依赖
    job.stage = IMPORT_JOB_STAGE.EXTRACT_DEPENDENCIES
    await job.save()

    const extracted = extractPostDependencies(post)

    // 3. upsert 共享实体
    job.stage = IMPORT_JOB_STAGE.UPSERT_SHARED_ENTITIES
    await job.save()

    const upsertCtx = { warnings }

    const authorId = await shared.upsertAuthor(
      extracted.author,
      languageCode,
      upsertCtx
    )
    const sortId = await shared.upsertSort(
      extracted.sort,
      languageCode,
      upsertCtx
    )
    const tagIds = await shared.upsertMany(
      extracted.tags,
      shared.upsertTag,
      languageCode,
      upsertCtx
    )
    const mappointIds = await shared.upsertMany(
      extracted.mappoints,
      shared.upsertMappoint,
      languageCode,
      upsertCtx
    )

    // 封面附件：按 sourceId 建档（remote）
    const coverAttachmentIds = []
    for (let i = 0; i < extracted.coverAttachments.length; i++) {
      const id = await shared.upsertRemoteAttachmentBySourceId(
        extracted.coverAttachments[i],
        languageCode,
        upsertCtx
      )
      if (id) coverAttachmentIds.push(id)
    }

    // 关联实体
    const bangumiIds = await upsertRelatedList(
      'bangumi',
      extracted.bangumis,
      languageCode,
      upsertCtx
    )
    const movieIds = await upsertRelatedList(
      'movie',
      extracted.movies,
      languageCode,
      upsertCtx
    )
    const gameIds = await upsertRelatedList(
      'game',
      extracted.games,
      languageCode,
      upsertCtx
    )
    const bookIds = await upsertRelatedList(
      'book',
      extracted.books,
      languageCode,
      upsertCtx
    )
    const eventIds = await upsertRelatedList(
      'event',
      extracted.events,
      languageCode,
      upsertCtx
    )
    const voteIds = await shared.upsertMany(
      extracted.votes,
      shared.upsertVote,
      languageCode,
      upsertCtx
    )
    const contentBangumiIds = await upsertRelatedList(
      'bangumi',
      extracted.contentBangumis,
      languageCode,
      upsertCtx
    )
    const contentMovieIds = await upsertRelatedList(
      'movie',
      extracted.contentMovies,
      languageCode,
      upsertCtx
    )
    const contentGameIds = await upsertRelatedList(
      'game',
      extracted.contentGames,
      languageCode,
      upsertCtx
    )
    const contentBookIds = await upsertRelatedList(
      'book',
      extracted.contentBooks,
      languageCode,
      upsertCtx
    )
    const contentEventIds = await upsertRelatedList(
      'event',
      extracted.contentEvents,
      languageCode,
      upsertCtx
    )
    const contentVoteIds = await shared.upsertMany(
      extracted.contentVotes,
      shared.upsertVote,
      languageCode,
      upsertCtx
    )

    // 关联文章：创建 stub
    const relatedPostIds = await upsertRelatedPostsList(
      extracted.relatedPosts,
      languageCode,
      upsertCtx
    )
    const relatedTweetIds = await upsertRelatedPostsList(
      extracted.relatedTweets,
      languageCode,
      upsertCtx
    )
    const contentPostIds = await upsertRelatedPostsList(
      extracted.contentPosts,
      languageCode,
      upsertCtx
    )
    const contentTweetIds = await upsertRelatedPostsList(
      extracted.contentTweets,
      languageCode,
      upsertCtx
    )

    // HTML 媒体附件：登记为 remote + htmlDiscovered
    if (
      extracted.htmlExtract &&
      Array.isArray(extracted.htmlExtract.mediaItems)
    ) {
      for (let i = 0; i < extracted.htmlExtract.mediaItems.length; i++) {
        const item = extracted.htmlExtract.mediaItems[i]
        if (item.relative) {
          await shared.upsertRemoteAttachmentByRelativePath(
            item.relative,
            languageCode
          )
        } else if (item.external) {
          await shared.upsertRemoteAttachmentByExternalUrl(
            item.external,
            languageCode
          )
        }
      }
    }

    // 4. upsert 文章
    job.stage = IMPORT_JOB_STAGE.UPSERT_POST
    await job.save()

    const upsertResult = await createOrOverwritePost({
      postCore: extracted.post,
      languageCode,
      confirmOverwrite,
      importJobId: job._id,
      deps: {
        authorId,
        sortId,
        tagIds,
        mappointIds,
        coverAttachmentIds,
        bangumiIds,
        movieIds,
        gameIds,
        bookIds,
        eventIds,
        voteIds,
        relatedPostIds,
        relatedTweetIds,
        contentBangumiIds,
        contentMovieIds,
        contentGameIds,
        contentBookIds,
        contentEventIds,
        contentVoteIds,
        contentPostIds,
        contentTweetIds
      },
      depsSourceIds: {
        authorSourceId: extracted.author && extracted.author.sourceId,
        sortSourceId: extracted.sort && extracted.sort.sourceId,
        tagSourceIds: extracted.tags.map(pickSrc),
        mappointSourceIds: extracted.mappoints.map(pickSrc),
        coverAttachmentSourceIds: extracted.coverAttachments.map(pickSrc),
        bangumiSourceIds: extracted.bangumis.map(pickSrc),
        movieSourceIds: extracted.movies.map(pickSrc),
        gameSourceIds: extracted.games.map(pickSrc),
        bookSourceIds: extracted.books.map(pickSrc),
        eventSourceIds: extracted.events.map(pickSrc),
        voteSourceIds: extracted.votes.map(pickSrc),
        relatedPostSourceIds: extracted.relatedPosts.map(pickSrc),
        relatedTweetSourceIds: extracted.relatedTweets.map(pickSrc),
        contentBangumiSourceIds: extracted.contentBangumis.map(pickSrc),
        contentMovieSourceIds: extracted.contentMovies.map(pickSrc),
        contentGameSourceIds: extracted.contentGames.map(pickSrc),
        contentBookSourceIds: extracted.contentBooks.map(pickSrc),
        contentEventSourceIds: extracted.contentEvents.map(pickSrc),
        contentVoteSourceIds: extracted.contentVotes.map(pickSrc),
        contentPostSourceIds: extracted.contentPosts.map(pickSrc),
        contentTweetSourceIds: extracted.contentTweets.map(pickSrc)
      }
    })

    // 5. finalize
    job.stage = IMPORT_JOB_STAGE.FINALIZE
    job.status = IMPORT_JOB_STATUS.SUCCESS
    job.resultPostId = upsertResult.doc._id
    job.warnings = warnings
    job.finishedAt = new Date()
    await job.save()

    return {
      jobId: String(job._id),
      postId: String(upsertResult.doc._id),
      mode: upsertResult.mode,
      warnings
    }
  } catch (err) {
    job.status = IMPORT_JOB_STATUS.FAILED
    job.errorList = [
      {
        code: err instanceof AppError ? err.code : 'UNCAUGHT',
        message: err.message || String(err),
        details: err instanceof AppError ? err.details : null
      }
    ]
    job.warnings = warnings
    job.finishedAt = new Date()
    try {
      await job.save()
    } catch (saveErr) {
      logger.error('保存失败的 importJob 记录时出错:', saveErr.message)
    }
    throw err
  }
}

function pickSrc(item) {
  return item && item.sourceId ? item.sourceId : null
}

async function upsertRelatedList(kind, list, languageCode, ctx) {
  if (!Array.isArray(list)) return []
  const ids = []
  for (let i = 0; i < list.length; i++) {
    const id = await shared.upsertRelatedEntity(
      kind,
      list[i],
      languageCode,
      ctx
    )
    if (id) ids.push(id)
  }
  return ids
}

async function upsertRelatedPostsList(list, languageCode, ctx) {
  if (!Array.isArray(list)) return []
  const ids = []
  for (let i = 0; i < list.length; i++) {
    const id = await shared.upsertPostStub(list[i], languageCode, ctx)
    if (id) ids.push(id)
  }
  return ids
}

module.exports = {
  importPost
}
