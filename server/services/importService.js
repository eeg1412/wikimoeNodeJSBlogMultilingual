import AsyncLock from 'async-lock'
import { resolveSourcePost } from './sourceBlogClient.js'
import {
  extractPostDependencies,
  extractHtmlAssets,
  computePayloadHash
} from './contentExtractor.js'
import { normalizeObjectUrls } from '../utils/sourceUrlNormalizer.js'
import { getSystemConfig } from '../config/globalConfig.js'
import { sanitizeHtml, validateHtmlSafety } from './htmlSanitizer.js'
import Post from '../mongodb/models/post.js'
import Author from '../mongodb/models/author.js'
import Sort from '../mongodb/models/sort.js'
import Tag from '../mongodb/models/tag.js'
import Mappoint from '../mongodb/models/mappoint.js'
import Attachment from '../mongodb/models/attachment.js'
import ImportJob from '../mongodb/models/importJob.js'
import {
  Bangumi,
  Movie,
  Game,
  Book,
  Event
} from '../mongodb/models/entities.js'
import Vote from '../mongodb/models/vote.js'
import {
  TRANSLATION_STATUS,
  ATTACHMENT_SOURCE_TYPE,
  ATTACHMENT_IMPORT_ORIGIN,
  POST_STATUS
} from '../../common/constants/index.js'
import { creatSha256Str } from '../utils/utils.js'

const lock = new AsyncLock({ timeout: 60000 })

/**
 * 执行文章导入流程
 * @param {object} params
 * @param {string} params.sourceIdentifier
 * @param {string} params.languageCode
 * @param {boolean} params.confirmOverwrite
 * @param {string} params.operatorAdminId
 * @returns {Promise<{ postId: string, isNew: boolean, warnings: string[] }>}
 */
export async function importPost({
  sourceIdentifier,
  languageCode,
  confirmOverwrite,
  operatorAdminId
}) {
  const lockKey = `import:${sourceIdentifier}:${languageCode}`

  return lock.acquire(lockKey, async () => {
    const systemConfig = getSystemConfig()
    const sourceBlogPublicOrigin = systemConfig.sourceBlogPublicOrigin || ''

    // 创建 job 记录
    const job = await ImportJob.create({
      sourceIdentifier,
      languageCode,
      operatorAdminId,
      status: 'running',
      stage: 'resolveSource'
    })

    try {
      // ── Stage 1: 从原站拉取数据 ────────────────────────────────
      let sourcePost
      try {
        sourcePost = await resolveSourcePost(sourceIdentifier)
      } catch (err) {
        await finishJob(job, 'failed', { errors: [err.message] })
        throw err
      }

      const sourceId = String(sourcePost._id || sourcePost.id)
      job.sourceResolvedId = sourceId

      // ── Stage 2: 检查重复导入 ──────────────────────────────────
      const existing = await Post.findOne({ sourceId, languageCode })
      if (existing && !confirmOverwrite) {
        await finishJob(job, 'cancelled', {
          errors: ['该语言文章已存在，请确认覆盖']
        })
        return {
          alreadyExists: true,
          postId: String(existing._id),
          warnings: ['该语言文章已存在，可传 confirmOverwrite=true 确认覆盖']
        }
      }

      // ── Stage 3: 数据归一化 ────────────────────────────────────
      job.stage = 'extractDependencies'
      await job.save()

      // 对整个 sourcePost 进行 URL 归一化
      const normalizedPost = normalizeObjectUrls(
        sourcePost,
        sourceBlogPublicOrigin
      )

      // 提取依赖
      const deps = extractPostDependencies(
        normalizedPost,
        sourceBlogPublicOrigin
      )
      const { assets, errors: htmlErrors } = extractHtmlAssets(
        deps.content,
        sourceBlogPublicOrigin
      )

      const payloadHash = computePayloadHash(normalizedPost)
      const sourceSnapshot = normalizedPost

      // ── Stage 4: Upsert 共享实体 ──────────────────────────────
      job.stage = 'upsertSharedEntities'
      await job.save()

      const warnings = [...htmlErrors]

      // 作者
      let authorDoc = null
      if (deps.author && (deps.author._id || deps.author.id)) {
        authorDoc = await upsertAuthor(
          deps.author,
          languageCode,
          sourceBlogPublicOrigin
        )
      }

      // 分类（含父级）
      let sortDoc = null
      if (deps.sort) {
        sortDoc = await upsertSort(deps.sort, languageCode)
      }

      // 标签
      const tagDocs = []
      for (const tag of deps.tags) {
        if (tag) tagDocs.push(await upsertTag(tag, languageCode))
      }

      // 地点
      const mappointDocs = []
      for (const mp of deps.mappointList) {
        if (mp) mappointDocs.push(await upsertMappoint(mp, languageCode))
      }

      // 封面附件
      const coverImageDocs = []
      for (const cover of deps.coverImages) {
        if (cover) {
          const doc = await upsertRemoteAttachment(
            cover,
            languageCode,
            sourceBlogPublicOrigin
          )
          if (doc) coverImageDocs.push(doc._id)
        }
      }

      // 关联实体
      const bangumiDocs = await upsertEntities(
        deps.bangumiList,
        Bangumi,
        languageCode
      )
      const movieDocs = await upsertEntities(
        deps.movieList,
        Movie,
        languageCode
      )
      const gameDocs = await upsertEntities(deps.gameList, Game, languageCode)
      const bookDocs = await upsertEntities(deps.bookList, Book, languageCode)
      const eventDocs = await upsertEntities(
        deps.eventList,
        Event,
        languageCode
      )
      const voteDocs = await upsertVotes(deps.voteList, languageCode)

      const contentBangumiDocs = await upsertEntities(
        deps.contentBangumiList,
        Bangumi,
        languageCode
      )
      const contentMovieDocs = await upsertEntities(
        deps.contentMovieList,
        Movie,
        languageCode
      )
      const contentGameDocs = await upsertEntities(
        deps.contentGameList,
        Game,
        languageCode
      )
      const contentBookDocs = await upsertEntities(
        deps.contentBookList,
        Book,
        languageCode
      )
      const contentEventDocs = await upsertEntities(
        deps.contentEventList,
        Event,
        languageCode
      )
      const contentVoteDocs = await upsertVotes(
        deps.contentVoteList,
        languageCode
      )

      // 关联文章 stub 处理
      const postListDocs = await upsertRelatedPostStubs(
        deps.postList,
        languageCode
      )
      const tweetListDocs = await upsertRelatedPostStubs(
        deps.tweetList,
        languageCode
      )
      const contentPostDocs = await upsertRelatedPostStubs(
        deps.contentPostList,
        languageCode
      )
      const contentTweetDocs = await upsertRelatedPostStubs(
        deps.contentTweetList,
        languageCode
      )

      // ── Stage 5: Upsert 文章 ──────────────────────────────────
      job.stage = 'upsertPost'
      await job.save()

      // HTML 安全校验
      const safeContent = sanitizeHtml(deps.content)
      const htmlSafetyErrors = validateHtmlSafety(safeContent)
      if (htmlSafetyErrors.length > 0) {
        warnings.push(...htmlSafetyErrors.map(e => `[HTML安全] ${e}`))
      }

      const postData = {
        sourceId,
        sourceAlias: deps.alias,
        groupSourceId: sourceId,
        languageCode,
        type: deps.type,
        title: deps.title,
        excerpt: deps.excerpt,
        content: safeContent,
        alias: deps.alias,
        date: deps.date ? new Date(deps.date) : null,
        lastChangDate: deps.lastChangDate ? new Date(deps.lastChangDate) : null,
        status:
          existing && confirmOverwrite ? POST_STATUS.DRAFT : POST_STATUS.DRAFT,
        allowRemark: false,
        author: authorDoc?._id || null,
        sort: sortDoc?._id || null,
        tags: tagDocs.map(d => d._id),
        mappointList: mappointDocs.map(d => d._id),
        coverImages: coverImageDocs,
        bangumiList: bangumiDocs,
        movieList: movieDocs,
        gameList: gameDocs,
        bookList: bookDocs,
        eventList: eventDocs,
        voteList: voteDocs,
        postList: postListDocs,
        tweetList: tweetListDocs,
        contentBangumiList: contentBangumiDocs,
        contentMovieList: contentMovieDocs,
        contentGameList: contentGameDocs,
        contentBookList: contentBookDocs,
        contentEventList: contentEventDocs,
        contentVoteList: contentVoteDocs,
        contentPostList: contentPostDocs,
        contentTweetList: contentTweetDocs,
        sourceSnapshot,
        sourceHash: payloadHash,
        translationStatus:
          existing && confirmOverwrite
            ? payloadHash !== existing.sourceHash
              ? TRANSLATION_STATUS.OUTDATED
              : TRANSLATION_STATUS.PENDING
            : TRANSLATION_STATUS.PENDING,
        importMeta: {
          importedAt: new Date(),
          importedBy: operatorAdminId,
          importJobId: String(job._id)
        }
      }

      let postDoc
      if (existing && confirmOverwrite) {
        // 覆盖更新
        postDoc = await Post.findByIdAndUpdate(existing._id, postData, {
          new: true
        })
      } else {
        // 新建
        postDoc = await Post.create(postData)
      }

      // ── Stage 6: 完成 ────────────────────────────────────────
      job.stage = 'finalize'
      job.sourcePayload = normalizedPost
      job.sourcePayloadHash = payloadHash
      await finishJob(job, 'success', { resultPostId: postDoc._id, warnings })

      return {
        alreadyExists: false,
        postId: String(postDoc._id),
        isNew: !existing || !confirmOverwrite,
        warnings
      }
    } catch (err) {
      await finishJob(job, 'failed', { errors: [err.message] })
      throw err
    }
  })
}

// ────────────── 辅助函数 ──────────────────────────────────────────

async function finishJob(job, status, { errors, warnings, resultPostId } = {}) {
  job.status = status
  job.finishedAt = new Date()
  if (errors) job.errors = errors
  if (warnings) job.warnings = warnings
  if (resultPostId) job.resultPostId = resultPostId
  await job.save()
}

async function upsertAuthor(authorData, languageCode, sourceBlogPublicOrigin) {
  const sourceId = String(authorData._id || authorData.id)
  const snapshot = normalizeObjectUrls(authorData, sourceBlogPublicOrigin)
  const hash = creatSha256Str(JSON.stringify(snapshot))

  const existing = await Author.findOne({ sourceId, languageCode })
  if (existing) {
    if (existing.sourceHash !== hash) {
      existing.sourceSnapshot = snapshot
      existing.sourceHash = hash
      existing.translationStatus = TRANSLATION_STATUS.OUTDATED
      await existing.save()
    }
    return existing
  }

  return Author.create({
    sourceId,
    languageCode,
    nickname: authorData.nickname || authorData.name || '',
    description: authorData.description || '',
    sourceSnapshot: snapshot,
    sourceHash: hash,
    translationStatus: TRANSLATION_STATUS.PENDING
  })
}

async function upsertSort(sortData, languageCode) {
  const sourceId = String(sortData._id || sortData.id)
  const hash = creatSha256Str(JSON.stringify(sortData))

  const existing = await Sort.findOne({ sourceId, languageCode })
  if (existing) {
    if (existing.sourceHash !== hash) {
      existing.sourceHash = hash
      existing.translationStatus = TRANSLATION_STATUS.OUTDATED
      await existing.save()
    }
    return existing
  }

  return Sort.create({
    sourceId,
    languageCode,
    sortname: sortData.sortname || sortData.name || '',
    alias: sortData.alias || '',
    description: sortData.description || '',
    taxis: sortData.taxis || 0,
    parentSourceId: sortData.parent
      ? String(sortData.parent._id || sortData.parent)
      : '',
    sourceSnapshot: sortData,
    sourceHash: hash,
    translationStatus: TRANSLATION_STATUS.PENDING
  })
}

async function upsertTag(tagData, languageCode) {
  const sourceId = String(tagData._id || tagData.id)
  const hash = creatSha256Str(JSON.stringify(tagData))

  const existing = await Tag.findOne({ sourceId, languageCode })
  if (existing) {
    if (existing.sourceHash !== hash) {
      existing.sourceHash = hash
      existing.translationStatus = TRANSLATION_STATUS.OUTDATED
      await existing.save()
    }
    return existing
  }

  return Tag.create({
    sourceId,
    languageCode,
    tagname: tagData.tagname || tagData.name || '',
    sourceSnapshot: tagData,
    sourceHash: hash,
    translationStatus: TRANSLATION_STATUS.PENDING
  })
}

async function upsertMappoint(mpData, languageCode) {
  const sourceId = String(mpData._id || mpData.id)
  const hash = creatSha256Str(JSON.stringify(mpData))

  const existing = await Mappoint.findOne({ sourceId, languageCode })
  if (existing) {
    if (existing.sourceHash !== hash) {
      existing.sourceHash = hash
      existing.translationStatus = TRANSLATION_STATUS.OUTDATED
      await existing.save()
    }
    return existing
  }

  return Mappoint.create({
    sourceId,
    languageCode,
    title: mpData.title || '',
    summary: mpData.summary || '',
    longitude: mpData.longitude || 0,
    latitude: mpData.latitude || 0,
    zIndex: mpData.zIndex || 0,
    status: mpData.status ?? 1,
    sourceSnapshot: mpData,
    sourceHash: hash,
    translationStatus: TRANSLATION_STATUS.PENDING
  })
}

async function upsertRemoteAttachment(
  attachData,
  languageCode,
  sourceBlogPublicOrigin
) {
  if (!attachData) return null
  const sourceId = String(attachData._id || attachData.id || '')
  if (!sourceId) return null

  const existing = await Attachment.findOne({
    sourceId,
    languageCode,
    attachmentSourceType: 'remote'
  })
  if (existing) return existing

  // 归一化 filepath
  const rawFilepath = attachData.filepath || attachData.path || ''
  const filepath = normalizeObjectUrls(rawFilepath, sourceBlogPublicOrigin)
  const sourcePath =
    typeof filepath === 'string' && filepath.startsWith('/') ? filepath : ''
  const { computeSourcePathHash } =
    await import('../utils/sourceUrlNormalizer.js')
  const sourcePathHash = sourcePath ? computeSourcePathHash(sourcePath) : ''

  return Attachment.create({
    attachmentSourceType: ATTACHMENT_SOURCE_TYPE.REMOTE,
    attachmentGroupKey: sourceId,
    sourceId,
    languageCode,
    sourcePath,
    sourcePathHash,
    filename: attachData.filename || '',
    filepath: sourcePath || filepath,
    name: attachData.name || '',
    description: attachData.description || '',
    filesize: attachData.filesize || 0,
    width: attachData.width || 0,
    height: attachData.height || 0,
    mimetype: attachData.mimetype || '',
    importOrigin: ATTACHMENT_IMPORT_ORIGIN.SOURCE_ATTACHMENT,
    sourceSnapshot: attachData,
    sourceHash: creatSha256Str(JSON.stringify(attachData)),
    translationStatus: TRANSLATION_STATUS.NOT_REQUIRED
  })
}

async function upsertEntities(entityList, Model, languageCode) {
  const ids = []
  for (const item of entityList || []) {
    if (!item) continue
    const sourceId = String(item._id || item.id)
    const hash = creatSha256Str(JSON.stringify(item))
    let doc = await Model.findOne({ sourceId, languageCode })
    if (doc) {
      if (doc.sourceHash !== hash) {
        doc.sourceHash = hash
        doc.translationStatus = TRANSLATION_STATUS.OUTDATED
        doc.sourceSnapshot = item
        doc.rawData = item
        await doc.save()
      }
    } else {
      doc = await Model.create({
        sourceId,
        languageCode,
        title: item.title || item.name || '',
        description: item.description || '',
        rawData: item,
        sourceSnapshot: item,
        sourceHash: hash,
        translationStatus: TRANSLATION_STATUS.PENDING
      })
    }
    ids.push(doc._id)
  }
  return ids
}

async function upsertVotes(voteList, languageCode) {
  const ids = []
  for (const item of voteList || []) {
    if (!item) continue
    const sourceId = String(item._id || item.id)
    const hash = creatSha256Str(JSON.stringify(item))
    let doc = await Vote.findOne({ sourceId, languageCode })
    if (doc) {
      if (doc.sourceHash !== hash) {
        doc.sourceHash = hash
        doc.translationStatus = TRANSLATION_STATUS.OUTDATED
        await doc.save()
      }
    } else {
      const options = (item.options || []).map(opt => ({
        sourceOptionId: String(opt._id || opt.id),
        title: opt.title || '',
        rawOption: opt
      }))
      doc = await Vote.create({
        sourceId,
        languageCode,
        title: item.title || '',
        options,
        rawData: item,
        sourceSnapshot: item,
        sourceHash: hash,
        translationStatus: TRANSLATION_STATUS.PENDING
      })
    }
    ids.push(doc._id)
  }
  return ids
}

/**
 * 关联 post/tweet 建立 stub 或复用已有记录
 */
async function upsertRelatedPostStubs(relatedList, languageCode) {
  const ids = []
  for (const item of relatedList || []) {
    if (!item) continue
    const sourceId = String(item._id || item.id)
    let doc = await Post.findOne({ sourceId, languageCode })
    if (!doc) {
      // 建立 stub
      doc = await Post.create({
        sourceId,
        sourceAlias: item.alias || '',
        groupSourceId: sourceId,
        languageCode,
        type: item.type || 1,
        title: item.title || '',
        excerpt: '',
        content: '',
        status: POST_STATUS.DRAFT,
        allowRemark: false,
        sourceSnapshot: item,
        sourceHash: creatSha256Str(JSON.stringify(item)),
        translationStatus: TRANSLATION_STATUS.STUB
      })
    }
    ids.push(doc._id)
  }
  return ids
}
