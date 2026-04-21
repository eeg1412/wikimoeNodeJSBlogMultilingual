const AsyncLock = require('async-lock')
const path = require('path')
const db = require('../mongodb')
const env = require('../config/env')
const HttpError = require('../utils/httpError')
const { hashObject, sha256 } = require('../utils/hash')
const { normalizeSourceValueDeep, normalizeSourceUrl } = require('../utils/sourceUrl')
const { normalizeInternalUrlsInHtml, extractHtmlMediaReferences } = require('../utils/html')
const { getEntityConfig, getEntityInitialTranslationStatus } = require('./entityRegistry')
const sourceBlogClient = require('./sourceBlogClient')
const {
  ATTACHMENT_IMPORT_ORIGIN,
  ATTACHMENT_SOURCE_TYPE,
  POST_STATUS,
  TRANSLATION_STATUS
} = require('../../common/constants')

const importLock = new AsyncLock()

const RELATED_ENTITY_LIST_MAP = {
  bangumiList: 'bangumi',
  movieList: 'movie',
  gameList: 'game',
  bookList: 'book',
  eventList: 'event',
  voteList: 'vote',
  contentBangumiList: 'bangumi',
  contentMovieList: 'movie',
  contentGameList: 'game',
  contentBookList: 'book',
  contentEventList: 'event',
  contentVoteList: 'vote'
}

function toId(value) {
  if (value === undefined || value === null) {
    return null
  }
  return String(value)
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function buildImportJobPayload(sourceIdentifier, languageCode, adminId) {
  return {
    sourceIdentifier,
    sourceResolvedId: '',
    languageCode,
    operatorAdminId: adminId || null,
    status: 'running',
    stage: 'resolveSource',
    sourcePayload: {},
    sourcePayloadHash: '',
    warnings: [],
    errors: [],
    startedAt: new Date(),
    finishedAt: null
  }
}

async function updateImportJob(importJobId, payload) {
  await db.utils.importJobs.updateOne({ _id: importJobId }, { $set: payload })
}

function buildSourceSyncedDocument(existing, mappedData, entityType, snapshot, sourceHash) {
  const config = getEntityConfig(entityType)
  const baseData = {
    ...mappedData,
    sourceSnapshot: snapshot,
    sourceHash
  }

  if (!existing) {
    return {
      ...baseData,
      translationStatus: getEntityInitialTranslationStatus(entityType, mappedData),
      isManualEdited: false
    }
  }

  if (existing.sourceHash === sourceHash) {
    const preserved = {}
    for (const field of config.translatableFields || []) {
      preserved[field] = existing[field]
    }
    return {
      ...baseData,
      ...preserved,
      translationStatus: existing.translationStatus,
      isManualEdited: existing.isManualEdited
    }
  }

  const nextStatus = getEntityInitialTranslationStatus(entityType, mappedData)
  const preserved = {}
  for (const field of config.translatableFields || []) {
    preserved[field] = existing[field]
  }

  return {
    ...baseData,
    ...preserved,
    translationStatus:
      nextStatus === TRANSLATION_STATUS.NOT_REQUIRED
        ? nextStatus
        : TRANSLATION_STATUS.OUTDATED,
    isManualEdited: existing.isManualEdited
  }
}

function normalizeAttachmentCandidate(source) {
  if (!source) {
    return null
  }
  if (typeof source === 'string') {
    return {
      filepath: source,
      filename: path.basename(source)
    }
  }
  if (source.filepath || source.photo || source.src || source.url) {
    return {
      ...source,
      filepath: source.filepath || source.photo || source.src || source.url,
      filename:
        source.filename ||
        (source.filepath || source.photo || source.src || source.url
          ? path.basename(source.filepath || source.photo || source.src || source.url)
          : '')
    }
  }
  return null
}

async function upsertRemoteAttachment(rawSource, languageCode, importOrigin) {
  const candidate = normalizeAttachmentCandidate(rawSource)
  if (!candidate?.filepath) {
    return null
  }

  const normalizedPath = normalizeSourceUrl(
    candidate.filepath,
    env.SOURCE_BLOG_PUBLIC_ORIGIN
  )
  const sourceSnapshot = normalizeSourceValueDeep(
    {
      ...candidate,
      filepath: normalizedPath
    },
    env.SOURCE_BLOG_PUBLIC_ORIGIN
  )
  const sourceHash = hashObject(sourceSnapshot)
  const isInternal = typeof normalizedPath === 'string' && normalizedPath.startsWith('/')

  const filter = {
    languageCode,
    attachmentSourceType: ATTACHMENT_SOURCE_TYPE.REMOTE
  }
  if (candidate._id) {
    filter.sourceId = toId(candidate._id)
  } else if (isInternal) {
    filter.sourcePathHash = sha256(normalizedPath)
  } else {
    filter.externalUrlHash = sha256(normalizedPath)
  }

  const existing = await db.utils.attachments.findOne(filter)
  const mappedData = {
    attachmentSourceType: ATTACHMENT_SOURCE_TYPE.REMOTE,
    attachmentGroupKey: candidate._id ? toId(candidate._id) : sha256(normalizedPath),
    sourceId: candidate._id ? toId(candidate._id) : null,
    languageCode,
    sourcePath: isInternal ? normalizedPath : null,
    sourcePathHash: isInternal ? sha256(normalizedPath) : null,
    externalUrl: isInternal ? null : normalizedPath,
    externalUrlHash: isInternal ? null : sha256(normalizedPath),
    filename: candidate.filename || path.basename(normalizedPath),
    filepath: isInternal ? normalizedPath : '',
    storagePath: '',
    name: candidate.name || candidate.title || '',
    description: candidate.description || candidate.alt || '',
    filesize: candidate.filesize || 0,
    fileHash: '',
    width: candidate.width || null,
    height: candidate.height || null,
    mimetype: candidate.mimetype || '',
    thumfor: candidate.thumfor || '',
    thumWidth: candidate.thumWidth || null,
    thumHeight: candidate.thumHeight || null,
    albumSourceId: candidate.album?._id ? toId(candidate.album._id) : null,
    is360Panorama: Boolean(candidate.is360Panorama),
    derivedFromSourceId: null,
    importOrigin
  }

  const syncedDocument = buildSourceSyncedDocument(
    existing,
    mappedData,
    'attachment',
    sourceSnapshot,
    sourceHash
  )

  return db.utils.attachments.upsertOne(filter, syncedDocument)
}

async function syncSharedEntity(entityType, rawSource, languageCode, context = {}) {
  if (!rawSource?._id) {
    return null
  }
  const config = getEntityConfig(entityType)
  const snapshot = normalizeSourceValueDeep(rawSource, env.SOURCE_BLOG_PUBLIC_ORIGIN)
  const sourceHash = hashObject(snapshot)
  const filter = {
    sourceId: toId(rawSource._id),
    languageCode
  }
  const existing = await db.utils[config.modelName].findOne(filter)
  const mappedData = config.mapSource(snapshot, context)
  const syncedDocument = buildSourceSyncedDocument(
    existing,
    {
      ...mappedData,
      sourceId: toId(rawSource._id),
      languageCode
    },
    entityType,
    snapshot,
    sourceHash
  )

  const doc = await db.utils[config.modelName].upsertOne(filter, syncedDocument)

  if (entityType === 'sort' && doc.parentSourceId) {
    const parentDoc = await db.utils.sorts.findOne({
      sourceId: doc.parentSourceId,
      languageCode
    })
    if (parentDoc && String(doc.parent || '') !== String(parentDoc._id)) {
      await db.utils.sorts.updateOne(
        { _id: doc._id },
        { $set: { parent: parentDoc._id } }
      )
      return db.utils.sorts.findOne({ _id: doc._id })
    }
  }

  return doc
}

async function registerHtmlDiscoveredAttachments(content, languageCode) {
  const refs = extractHtmlMediaReferences(content, env.SOURCE_BLOG_PUBLIC_ORIGIN)
  const results = []
  for (const ref of refs) {
    if (ref.tagName === 'a') {
      continue
    }
    const attachment = await upsertRemoteAttachment(
      {
        filepath: ref.normalizedValue,
        filename: path.basename(ref.normalizedValue || ''),
        description: ''
      },
      languageCode,
      ATTACHMENT_IMPORT_ORIGIN.HTML_DISCOVERED
    )
    if (attachment) {
      results.push(attachment)
    }
  }
  return results
}

async function upsertRelatedEntityLists(detail, languageCode) {
  const results = {}
  for (const [fieldName, entityType] of Object.entries(RELATED_ENTITY_LIST_MAP)) {
    results[fieldName] = []
    for (const item of asArray(detail[fieldName])) {
      const doc = await syncSharedEntity(entityType, item, languageCode)
      if (doc) {
        results[fieldName].push(doc._id)
      }
    }
  }
  return results
}

async function upsertRelatedPosts(detail, languageCode, warnings) {
  const results = {
    postList: [],
    tweetList: [],
    contentPostList: [],
    contentTweetList: []
  }

  const relationTypeMap = {
    postList: 1,
    contentPostList: 1,
    tweetList: 2,
    contentTweetList: 2
  }

  for (const [fieldName, type] of Object.entries(relationTypeMap)) {
    for (const item of asArray(detail[fieldName])) {
      const sourceId = toId(item._id)
      if (!sourceId) {
        continue
      }
      let existing = await db.utils.posts.findOne({ sourceId, languageCode })
      if (!existing) {
        const coverImages = []
        for (const coverImage of asArray(item.coverImages)) {
          const attachment = await upsertRemoteAttachment(
            coverImage,
            languageCode,
            ATTACHMENT_IMPORT_ORIGIN.SOURCE_ATTACHMENT
          )
          if (attachment) {
            coverImages.push(attachment._id)
          }
        }

        const sourceSnapshot = normalizeSourceValueDeep(item, env.SOURCE_BLOG_PUBLIC_ORIGIN)
        existing = await db.utils.posts.upsertOne(
          { sourceId, languageCode },
          {
            sourceId,
            groupSourceId: sourceId,
            sourceAlias: item.alias || '',
            languageCode,
            type,
            title: item.title || '',
            excerpt: item.excerpt || '',
            content: '',
            alias: item.alias || sourceId,
            date: item.date || new Date(),
            lastChangDate: item.date || new Date(),
            status: POST_STATUS.DRAFT,
            allowRemark: false,
            template: '',
            code: '',
            editorVersion: 5,
            coverImages,
            importMeta: {
              isStub: true,
              importedAt: new Date()
            },
            publishMeta: {},
            validationState: {
              isStub: true,
              errors: ['关联文章尚未导入']
            },
            sourceSnapshot,
            sourceHash: hashObject(sourceSnapshot),
            translationStatus: TRANSLATION_STATUS.STUB,
            isManualEdited: false
          }
        )
        warnings.push(`已为关联文章 ${item.title || sourceId} 创建 stub`) 
      }
      results[fieldName].push(existing._id)
    }
  }

  return results
}

function buildPostDocument(detail, languageCode, dependencies, sourceIdentifier, importJobId, existingPost) {
  const normalizedContent = normalizeInternalUrlsInHtml(
    detail.content || '',
    env.SOURCE_BLOG_PUBLIC_ORIGIN
  )

  const sourceSnapshot = normalizeSourceValueDeep(
    {
      ...detail,
      content: normalizedContent
    },
    env.SOURCE_BLOG_PUBLIC_ORIGIN
  )
  const sourceHash = hashObject(sourceSnapshot)
  const sourceChanged = existingPost ? existingPost.sourceHash !== sourceHash : false

  return {
    sourceId: toId(detail._id),
    sourceAlias: detail.alias || '',
    groupSourceId: toId(detail._id),
    languageCode,
    type: detail.type,
    title: detail.title || '',
    excerpt: detail.excerpt || '',
    content: normalizedContent,
    alias: detail.alias || toId(detail._id),
    date: detail.date || new Date(),
    lastChangDate: detail.lastChangDate || detail.date || new Date(),
    status: POST_STATUS.DRAFT,
    allowRemark: false,
    template: detail.template || '',
    code: detail.code || '',
    editorVersion: 5,
    coverImages: dependencies.coverImages,
    author: dependencies.authorId,
    sort: dependencies.sortId,
    tags: dependencies.tagIds,
    mappointList: dependencies.mappointIds,
    bangumiList: dependencies.relatedEntityLists.bangumiList,
    movieList: dependencies.relatedEntityLists.movieList,
    gameList: dependencies.relatedEntityLists.gameList,
    bookList: dependencies.relatedEntityLists.bookList,
    postList: dependencies.relatedPostLists.postList,
    tweetList: dependencies.relatedPostLists.tweetList,
    eventList: dependencies.relatedEntityLists.eventList,
    voteList: dependencies.relatedEntityLists.voteList,
    seriesSortList: asArray(detail.seriesSortList),
    contentBangumiList: dependencies.relatedEntityLists.contentBangumiList,
    contentMovieList: dependencies.relatedEntityLists.contentMovieList,
    contentGameList: dependencies.relatedEntityLists.contentGameList,
    contentBookList: dependencies.relatedEntityLists.contentBookList,
    contentPostList: dependencies.relatedPostLists.contentPostList,
    contentTweetList: dependencies.relatedPostLists.contentTweetList,
    contentEventList: dependencies.relatedEntityLists.contentEventList,
    contentVoteList: dependencies.relatedEntityLists.contentVoteList,
    contentSeriesSortList: asArray(detail.contentSeriesSortList),
    importMeta: {
      importedAt: new Date(),
      importJobId,
      sourceIdentifier
    },
    publishMeta: existingPost?.publishMeta || {},
    validationState: {
      needsRefresh: true,
      errors: sourceChanged ? ['源文发生变更，需要重新确认'] : []
    },
    sourceSnapshot,
    sourceHash,
    translationStatus:
      existingPost && sourceChanged
        ? TRANSLATION_STATUS.OUTDATED
        : TRANSLATION_STATUS.PENDING,
    isManualEdited: false
  }
}

async function importPost({ sourceIdentifier, languageCode, confirmOverwrite, adminId }) {
  const importJob = await db.utils.importJobs.save(
    buildImportJobPayload(sourceIdentifier, languageCode, adminId)
  )

  try {
    const result = await importLock.acquire(
      `post-import:${languageCode}:${sourceIdentifier}`,
      async () => {
        const detail = await sourceBlogClient.resolveImportablePost(sourceIdentifier)
        const sourceResolvedId = toId(detail._id)

        await updateImportJob(importJob._id, {
          sourceResolvedId,
          stage: 'extractDependencies'
        })

        const existingRunningJob = await db.utils.importJobs.findOne({
          _id: { $ne: importJob._id },
          sourceResolvedId,
          languageCode,
          status: 'running'
        })
        if (existingRunningJob) {
          throw new HttpError(409, '同一文章同一语言已有导入任务正在进行')
        }

        const existingPost = await db.utils.posts.findOne({
          sourceId: sourceResolvedId,
          languageCode
        })
        const canOverwriteWithoutConfirm =
          existingPost && existingPost.translationStatus === TRANSLATION_STATUS.STUB

        if (existingPost && !confirmOverwrite && !canOverwriteWithoutConfirm) {
          throw new HttpError(409, '当前语言文章已存在')
        }

        const warnings = []
        const normalizedAuthor = detail.author
          ? normalizeSourceValueDeep(detail.author, env.SOURCE_BLOG_PUBLIC_ORIGIN)
          : null

        const authorPhotoAttachment = normalizedAuthor?.photo
          ? await upsertRemoteAttachment(
              { filepath: normalizedAuthor.photo, name: `${normalizedAuthor.nickname || 'author'} photo` },
              languageCode,
              ATTACHMENT_IMPORT_ORIGIN.SOURCE_ATTACHMENT
            )
          : null
        const authorCoverAttachment = normalizedAuthor?.cover?.filepath
          ? await upsertRemoteAttachment(
              normalizedAuthor.cover,
              languageCode,
              ATTACHMENT_IMPORT_ORIGIN.SOURCE_ATTACHMENT
            )
          : null

        const authorDoc = detail.author
          ? await syncSharedEntity('author', detail.author, languageCode, {
              coverAttachmentId: authorCoverAttachment?._id || null,
              photoAttachmentId: authorPhotoAttachment?._id || null
            })
          : null

        const sortDoc = detail.sort
          ? await syncSharedEntity('sort', detail.sort, languageCode)
          : null

        const tagDocs = []
        for (const tag of asArray(detail.tags)) {
          const doc = await syncSharedEntity('tag', tag, languageCode)
          if (doc) {
            tagDocs.push(doc)
          }
        }

        const mappointDocs = []
        for (const item of asArray(detail.mappointList)) {
          const doc = await syncSharedEntity('mappoint', item, languageCode)
          if (doc) {
            mappointDocs.push(doc)
          }
        }

        const coverImages = []
        for (const coverImage of asArray(detail.coverImages)) {
          const attachment = await upsertRemoteAttachment(
            coverImage,
            languageCode,
            ATTACHMENT_IMPORT_ORIGIN.SOURCE_ATTACHMENT
          )
          if (attachment) {
            coverImages.push(attachment._id)
          }
        }

        const normalizedContent = normalizeInternalUrlsInHtml(
          detail.content || '',
          env.SOURCE_BLOG_PUBLIC_ORIGIN
        )
        await registerHtmlDiscoveredAttachments(normalizedContent, languageCode)

        await updateImportJob(importJob._id, {
          stage: 'upsertSharedEntities'
        })

        const relatedEntityLists = await upsertRelatedEntityLists(detail, languageCode)
        const relatedPostLists = await upsertRelatedPosts(detail, languageCode, warnings)

        const postDocument = buildPostDocument(
          { ...detail, content: normalizedContent },
          languageCode,
          {
            authorId: authorDoc?._id || null,
            sortId: sortDoc?._id || null,
            tagIds: tagDocs.map(item => item._id),
            mappointIds: mappointDocs.map(item => item._id),
            coverImages,
            relatedEntityLists,
            relatedPostLists
          },
          sourceIdentifier,
          importJob._id,
          existingPost
        )

        await updateImportJob(importJob._id, {
          stage: 'upsertPost',
          sourcePayload: postDocument.sourceSnapshot,
          sourcePayloadHash: postDocument.sourceHash
        })

        if (existingPost) {
          await db.utils.posts.updateOne(
            { _id: existingPost._id },
            { $set: postDocument }
          )
        } else {
          await db.utils.posts.upsertOne(
            { sourceId: sourceResolvedId, languageCode },
            postDocument
          )
        }

        const post = await db.utils.posts.findOne(
          { sourceId: sourceResolvedId, languageCode },
          undefined,
          { scope: 'detail' }
        )

        await updateImportJob(importJob._id, {
          stage: 'finalize',
          status: 'success',
          resultPostId: post._id,
          warnings,
          finishedAt: new Date()
        })

        return {
          importJobId: importJob._id,
          post,
          redirectPath: `/multilingual-admin/post/editor/${post._id}`,
          warnings
        }
      }
    )

    return result
  } catch (error) {
    await updateImportJob(importJob._id, {
      status: 'failed',
      errors: [error.message],
      finishedAt: new Date()
    })
    throw error
  }
}

module.exports = {
  importPost
}