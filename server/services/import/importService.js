const AsyncLock = require('async-lock')

const { createHash, createObjectHash } = require('../../../common/utils/hash')
const { importPostSchema } = require('../../../common/validation/import')
const attachmentsUtils = require('../../mongodb/utils/attachments')
const authorsUtils = require('../../mongodb/utils/authors')
const bangumisUtils = require('../../mongodb/utils/bangumis')
const booksUtils = require('../../mongodb/utils/books')
const eventsUtils = require('../../mongodb/utils/events')
const gamesUtils = require('../../mongodb/utils/games')
const importJobsUtils = require('../../mongodb/utils/importJobs')
const mappointsUtils = require('../../mongodb/utils/mappoints')
const moviesUtils = require('../../mongodb/utils/movies')
const postsUtils = require('../../mongodb/utils/posts')
const sortsUtils = require('../../mongodb/utils/sorts')
const tagsUtils = require('../../mongodb/utils/tags')
const votesUtils = require('../../mongodb/utils/votes')
const { normalizeSourcePayloadValue } = require('./normalizeSourcePayload')
const { extractHtmlMedia } = require('./extractHtmlMedia')
const { createSharedEntityService } = require('./sharedEntityUpsert')
const {
  normalizeSourceAssetPath,
  resolveImportablePostDetail
} = require('../source/sourceBlogClient')

const importLock = new AsyncLock()

function mapAuthor(entity) {
  return {
    nickname: entity.nickname || '',
    description: entity.description || ''
  }
}

function mapSort(entity) {
  const mappedSort = {
    sortname: entity.sortname || entity.name || '',
    description: entity.description || '',
    template: entity.template || '',
    taxis: typeof entity.taxis === 'number' ? entity.taxis : 0,
    parentSourceId: entity.parent ? String(entity.parent) : null
  }

  if (entity.alias && String(entity.alias).trim()) {
    mappedSort.alias = String(entity.alias).trim()
  }

  return mappedSort
}

function mapTag(entity) {
  return {
    tagname: entity.tagname || entity.name || '',
    lastusetime: entity.lastusetime || null
  }
}

function mapMappoint(entity) {
  return {
    title: entity.title || '',
    summary: entity.summary || '',
    longitude: entity.longitude || null,
    latitude: entity.latitude || null,
    zIndex: entity.zIndex || null,
    status: entity.status || null
  }
}

function mapRichEntity(entity) {
  return {
    title: entity.title || '',
    summary: entity.summary || entity.excerpt || '',
    description: entity.description || '',
    payload: entity
  }
}

function mapVote(entity) {
  const options = Array.isArray(entity.options)
    ? entity.options.map(function (option, index) {
        return {
          sourceOptionId: String(option._id || index),
          title: option.title || '',
          description: option.description || '',
          sort: typeof option.sort === 'number' ? option.sort : index
        }
      })
    : []

  return {
    title: entity.title || '',
    description: entity.description || '',
    options,
    payload: entity
  }
}

const authorService = createSharedEntityService(authorsUtils, mapAuthor)
const sortService = createSharedEntityService(sortsUtils, mapSort)
const tagService = createSharedEntityService(tagsUtils, mapTag)
const mappointService = createSharedEntityService(mappointsUtils, mapMappoint)
const bangumiService = createSharedEntityService(bangumisUtils, mapRichEntity)
const movieService = createSharedEntityService(moviesUtils, mapRichEntity)
const gameService = createSharedEntityService(gamesUtils, mapRichEntity)
const bookService = createSharedEntityService(booksUtils, mapRichEntity)
const eventService = createSharedEntityService(eventsUtils, mapRichEntity)
const voteService = createSharedEntityService(votesUtils, mapVote)

function getSourceContext(clientConfig) {
  return {
    sourceBlogApiBaseUrl: clientConfig.sourceBlogApiBaseUrl,
    sourceBlogPublicOrigin: clientConfig.sourceBlogPublicOrigin
  }
}

async function upsertRemoteAttachment(
  entity,
  languageCode,
  clientConfig,
  importOrigin
) {
  if (!entity) {
    return null
  }

  const normalizedFilePath = normalizeSourceAssetPath(
    entity.filepath || entity.src || entity.url || '',
    clientConfig
  )
  const sourcePath =
    typeof normalizedFilePath === 'string' && normalizedFilePath.startsWith('/')
      ? normalizedFilePath
      : null
  const externalUrl =
    typeof normalizedFilePath === 'string' &&
    /^https?:\/\//i.test(normalizedFilePath)
      ? normalizedFilePath
      : null
  const sourceId = entity._id ? String(entity._id) : null
  const sourceSnapshot = {
    sourceId,
    filename: entity.filename || '',
    filepath: normalizedFilePath,
    name: entity.name || '',
    description: entity.description || '',
    filesize: entity.filesize || 0,
    width: entity.width || null,
    height: entity.height || null,
    mimetype: entity.mimetype || '',
    thumfor: entity.thumfor || null,
    thumWidth: entity.thumWidth || null,
    thumHeight: entity.thumHeight || null,
    is360Panorama: entity.is360Panorama === true
  }
  const sourceHash = createObjectHash(sourceSnapshot)
  const query = {
    languageCode,
    attachmentSourceType: 'remote'
  }

  if (sourceId) {
    query.sourceId = sourceId
  } else if (sourcePath) {
    query.sourcePathHash = createHash(sourcePath)
  } else if (externalUrl) {
    query.externalUrlHash = createHash(externalUrl)
  } else {
    return null
  }

  const existingRecord = await attachmentsUtils.findOne(query)
  const translationStatus =
    existingRecord && existingRecord.sourceHash === sourceHash
      ? existingRecord.translationStatus || 'pending'
      : 'pending'

  return attachmentsUtils.findOneAndUpdate(
    query,
    {
      $set: {
        attachmentSourceType: 'remote',
        attachmentGroupKey: sourceId,
        sourceId,
        languageCode,
        sourcePath,
        sourcePathHash: sourcePath ? createHash(sourcePath) : null,
        externalUrl,
        externalUrlHash: externalUrl ? createHash(externalUrl) : null,
        filename: entity.filename || '',
        filepath: normalizedFilePath,
        storagePath: null,
        name: entity.name || '',
        description: entity.description || '',
        filesize: entity.filesize || 0,
        fileHash: null,
        width: entity.width || null,
        height: entity.height || null,
        mimetype: entity.mimetype || '',
        thumfor: entity.thumfor || null,
        thumWidth: entity.thumWidth || null,
        thumHeight: entity.thumHeight || null,
        albumSourceId: entity.albumSourceId
          ? String(entity.albumSourceId)
          : null,
        is360Panorama: entity.is360Panorama === true,
        derivedFromSourceId: null,
        importOrigin,
        sourceSnapshot,
        sourceHash,
        translationStatus
      },
      $setOnInsert: {
        isManualEdited: false
      }
    },
    {
      upsert: true,
      new: true
    }
  )
}

async function upsertHtmlDiscoveredAttachment(
  mediaRecord,
  languageCode,
  clientConfig
) {
  const entity = {
    _id: null,
    filename: mediaRecord.normalizedValue,
    filepath: mediaRecord.normalizedValue,
    mimetype: '',
    name: '',
    description: ''
  }

  return upsertRemoteAttachment(
    entity,
    languageCode,
    clientConfig,
    'htmlDiscovered'
  )
}

async function ensureStubPost(relatedPost, languageCode) {
  if (!relatedPost || !relatedPost._id) {
    return null
  }

  const sourceId = String(relatedPost._id)
  const existingPost = await postsUtils.findBySourceIdAndLanguage(
    sourceId,
    languageCode
  )

  if (existingPost) {
    return existingPost
  }

  return postsUtils.save({
    sourceId,
    sourceAlias: relatedPost.alias || null,
    groupSourceId: sourceId,
    languageCode,
    type: Number(relatedPost.type) === 2 ? 2 : 1,
    title: relatedPost.title || '',
    excerpt: relatedPost.excerpt || '',
    content: '',
    alias: `${languageCode}-stub-${sourceId}`,
    date: relatedPost.date || null,
    lastChangDate: relatedPost.lastChangDate || relatedPost.date || null,
    status: 0,
    allowRemark: false,
    template: '',
    code: '',
    editorVersion: 5,
    coverImages: [],
    author: null,
    sort: null,
    tags: [],
    mappointList: [],
    bangumiList: [],
    movieList: [],
    gameList: [],
    bookList: [],
    postList: [],
    tweetList: [],
    eventList: [],
    voteList: [],
    seriesSortList: [],
    contentBangumiList: [],
    contentMovieList: [],
    contentGameList: [],
    contentBookList: [],
    contentPostList: [],
    contentTweetList: [],
    contentEventList: [],
    contentVoteList: [],
    contentSeriesSortList: [],
    importMeta: {
      stub: true
    },
    publishMeta: null,
    validationState: null,
    sourceSnapshot: relatedPost,
    sourceHash: createObjectHash(relatedPost),
    translationStatus: 'stub',
    isManualEdited: false
  })
}

async function upsertPostRecord(
  payload,
  languageCode,
  existingPost,
  relationState
) {
  const postDocument = {
    sourceId: String(payload._id),
    sourceAlias: payload.alias || null,
    groupSourceId: String(payload._id),
    languageCode,
    type: Number(payload.type),
    title: payload.title || '',
    excerpt: payload.excerpt || '',
    content: relationState.content,
    alias: payload.alias || `${languageCode}-${String(payload._id)}`,
    date: payload.date || null,
    lastChangDate: payload.lastChangDate || payload.date || null,
    status: existingPost ? 0 : 0,
    allowRemark: false,
    template: payload.template || '',
    code: payload.code || '',
    editorVersion: 5,
    coverImages: relationState.coverImages,
    author: relationState.author,
    sort: relationState.sort,
    tags: relationState.tags,
    mappointList: relationState.mappointList,
    bangumiList: relationState.bangumiList,
    movieList: relationState.movieList,
    gameList: relationState.gameList,
    bookList: relationState.bookList,
    postList: relationState.postList,
    tweetList: relationState.tweetList,
    eventList: relationState.eventList,
    voteList: relationState.voteList,
    seriesSortList: relationState.seriesSortList,
    contentBangumiList: relationState.contentBangumiList,
    contentMovieList: relationState.contentMovieList,
    contentGameList: relationState.contentGameList,
    contentBookList: relationState.contentBookList,
    contentPostList: relationState.contentPostList,
    contentTweetList: relationState.contentTweetList,
    contentEventList: relationState.contentEventList,
    contentVoteList: relationState.contentVoteList,
    contentSeriesSortList: relationState.contentSeriesSortList,
    importMeta: relationState.importMeta,
    publishMeta: null,
    validationState: null,
    sourceSnapshot: relationState.normalizedPayload,
    sourceHash: relationState.sourceHash,
    translationStatus:
      existingPost && existingPost.sourceHash === relationState.sourceHash
        ? existingPost.translationStatus || 'pending'
        : existingPost
          ? 'outdated'
          : 'pending'
  }

  return postsUtils.findOneAndUpdate(
    {
      sourceId: String(payload._id),
      languageCode
    },
    {
      $set: postDocument,
      $setOnInsert: {
        isManualEdited: false
      }
    },
    {
      upsert: true,
      new: true
    }
  )
}

function splitRelatedPosts(relatedList) {
  const postList = []
  const tweetList = []

  for (const item of relatedList) {
    if (!item || !item._id) {
      continue
    }

    if (Number(item.type) === 2) {
      tweetList.push(item)
      continue
    }

    postList.push(item)
  }

  return {
    postList,
    tweetList
  }
}

async function createRunningImportJob(
  sourceIdentifier,
  sourceResolvedId,
  languageCode,
  operatorAdminId
) {
  return importJobsUtils.save({
    sourceIdentifier,
    sourceResolvedId,
    languageCode,
    operatorAdminId,
    status: 'running',
    stage: 'resolveSource',
    sourcePayload: null,
    sourcePayloadHash: null,
    resultPostId: null,
    warnings: [],
    errors: [],
    startedAt: new Date(),
    finishedAt: null
  })
}

async function updateImportJob(importJobId, params) {
  await importJobsUtils.findOneAndUpdate(
    { _id: importJobId },
    {
      $set: params
    },
    {
      new: true
    }
  )
}

async function importPost(input, operatorAdminId) {
  const validatedInput = await importPostSchema.validateAsync(input, {
    abortEarly: false,
    stripUnknown: true
  })

  return importLock.acquire(
    `import:${validatedInput.languageCode}:${validatedInput.sourceIdentifier}`,
    async function () {
      const detailResult = await resolveImportablePostDetail(
        validatedInput.sourceIdentifier
      )
      const payload = detailResult.payload

      if (!payload || !payload._id) {
        throw new Error('原站文章详情缺少 _id')
      }

      const sourceResolvedId = String(payload._id)
      const existingRunningJob = await importJobsUtils.findOne({
        sourceResolvedId,
        languageCode: validatedInput.languageCode,
        status: 'running'
      })

      if (existingRunningJob) {
        throw new Error('当前语言存在正在执行的导入任务')
      }

      const existingPost = await postsUtils.findBySourceIdAndLanguage(
        sourceResolvedId,
        validatedInput.languageCode
      )

      if (existingPost && !validatedInput.confirmOverwrite) {
        const duplicateError = new Error('当前语言文章已存在')
        duplicateError.code = 'DUPLICATE_IMPORT'
        duplicateError.meta = {
          existingPostId: String(existingPost._id)
        }
        throw duplicateError
      }

      const importJob = await createRunningImportJob(
        validatedInput.sourceIdentifier,
        sourceResolvedId,
        validatedInput.languageCode,
        operatorAdminId
      )

      try {
        const sourceContext = getSourceContext(detailResult.clientConfig)
        const normalizedPayload = normalizeSourcePayloadValue(
          payload,
          sourceContext
        )
        const htmlExtractionResult = extractHtmlMedia(
          normalizedPayload.content || '',
          sourceContext
        )

        normalizedPayload.content = htmlExtractionResult.content

        const sourceHash = createObjectHash(normalizedPayload)

        await updateImportJob(importJob._id, {
          stage: 'extractDependencies'
        })

        const authorRecord = await authorService.upsert(
          normalizedPayload.author,
          validatedInput.languageCode
        )
        const sortRecord = await sortService.upsert(
          normalizedPayload.sort,
          validatedInput.languageCode
        )
        const tagRecords = []
        const tags = Array.isArray(normalizedPayload.tags)
          ? normalizedPayload.tags
          : []
        for (const tag of tags) {
          const tagRecord = await tagService.upsert(
            tag,
            validatedInput.languageCode
          )
          if (tagRecord) {
            tagRecords.push(tagRecord._id)
          }
        }
        const mappointRecords = []
        const mappointList = Array.isArray(normalizedPayload.mappointList)
          ? normalizedPayload.mappointList
          : []
        for (const mappoint of mappointList) {
          const mappointRecord = await mappointService.upsert(
            mappoint,
            validatedInput.languageCode
          )
          if (mappointRecord) {
            mappointRecords.push(mappointRecord._id)
          }
        }

        await updateImportJob(importJob._id, {
          stage: 'upsertSharedEntities'
        })

        const coverImageRecords = []
        const coverImages = Array.isArray(normalizedPayload.coverImages)
          ? normalizedPayload.coverImages
          : []
        for (const coverImage of coverImages) {
          const coverImageRecord = await upsertRemoteAttachment(
            coverImage,
            validatedInput.languageCode,
            detailResult.clientConfig,
            'sourceAttachment'
          )
          if (coverImageRecord) {
            coverImageRecords.push(coverImageRecord._id)
          }
        }

        for (const mediaRecord of htmlExtractionResult.mediaList) {
          await upsertHtmlDiscoveredAttachment(
            mediaRecord,
            validatedInput.languageCode,
            detailResult.clientConfig
          )
        }

        const entityLists = {
          bangumiList: {
            list: [],
            input: normalizedPayload.bangumiList || [],
            service: bangumiService
          },
          movieList: {
            list: [],
            input: normalizedPayload.movieList || [],
            service: movieService
          },
          gameList: {
            list: [],
            input: normalizedPayload.gameList || [],
            service: gameService
          },
          bookList: {
            list: [],
            input: normalizedPayload.bookList || [],
            service: bookService
          },
          eventList: {
            list: [],
            input: normalizedPayload.eventList || [],
            service: eventService
          },
          voteList: {
            list: [],
            input: normalizedPayload.voteList || [],
            service: voteService
          },
          contentBangumiList: {
            list: [],
            input: normalizedPayload.contentBangumiList || [],
            service: bangumiService
          },
          contentMovieList: {
            list: [],
            input: normalizedPayload.contentMovieList || [],
            service: movieService
          },
          contentGameList: {
            list: [],
            input: normalizedPayload.contentGameList || [],
            service: gameService
          },
          contentBookList: {
            list: [],
            input: normalizedPayload.contentBookList || [],
            service: bookService
          },
          contentEventList: {
            list: [],
            input: normalizedPayload.contentEventList || [],
            service: eventService
          },
          contentVoteList: {
            list: [],
            input: normalizedPayload.contentVoteList || [],
            service: voteService
          }
        }

        for (const entityConfig of Object.values(entityLists)) {
          const inputList = Array.isArray(entityConfig.input)
            ? entityConfig.input
            : []
          for (const entity of inputList) {
            const record = await entityConfig.service.upsert(
              entity,
              validatedInput.languageCode
            )
            if (record) {
              entityConfig.list.push(record._id)
            }
          }
        }

        const relatedPostGroups = splitRelatedPosts([
          ...(Array.isArray(normalizedPayload.postList)
            ? normalizedPayload.postList
            : []),
          ...(Array.isArray(normalizedPayload.tweetList)
            ? normalizedPayload.tweetList
            : [])
        ])
        const contentRelatedPostGroups = splitRelatedPosts([
          ...(Array.isArray(normalizedPayload.contentPostList)
            ? normalizedPayload.contentPostList
            : []),
          ...(Array.isArray(normalizedPayload.contentTweetList)
            ? normalizedPayload.contentTweetList
            : [])
        ])

        const relatedPostIds = []
        for (const relatedPost of relatedPostGroups.postList) {
          const relatedRecord = await ensureStubPost(
            relatedPost,
            validatedInput.languageCode
          )
          if (relatedRecord) {
            relatedPostIds.push(relatedRecord._id)
          }
        }

        const relatedTweetIds = []
        for (const relatedTweet of relatedPostGroups.tweetList) {
          const relatedRecord = await ensureStubPost(
            relatedTweet,
            validatedInput.languageCode
          )
          if (relatedRecord) {
            relatedTweetIds.push(relatedRecord._id)
          }
        }

        const contentRelatedPostIds = []
        for (const relatedPost of contentRelatedPostGroups.postList) {
          const relatedRecord = await ensureStubPost(
            relatedPost,
            validatedInput.languageCode
          )
          if (relatedRecord) {
            contentRelatedPostIds.push(relatedRecord._id)
          }
        }

        const contentRelatedTweetIds = []
        for (const relatedTweet of contentRelatedPostGroups.tweetList) {
          const relatedRecord = await ensureStubPost(
            relatedTweet,
            validatedInput.languageCode
          )
          if (relatedRecord) {
            contentRelatedTweetIds.push(relatedRecord._id)
          }
        }

        await updateImportJob(importJob._id, {
          stage: 'upsertPost'
        })

        const savedPost = await upsertPostRecord(
          normalizedPayload,
          validatedInput.languageCode,
          existingPost,
          {
            normalizedPayload,
            content: htmlExtractionResult.content,
            sourceHash,
            author: authorRecord ? authorRecord._id : null,
            sort: sortRecord ? sortRecord._id : null,
            tags: tagRecords,
            mappointList: mappointRecords,
            coverImages: coverImageRecords,
            bangumiList: entityLists.bangumiList.list,
            movieList: entityLists.movieList.list,
            gameList: entityLists.gameList.list,
            bookList: entityLists.bookList.list,
            postList: relatedPostIds,
            tweetList: relatedTweetIds,
            eventList: entityLists.eventList.list,
            voteList: entityLists.voteList.list,
            seriesSortList: Array.isArray(normalizedPayload.seriesSortList)
              ? normalizedPayload.seriesSortList
              : [],
            contentBangumiList: entityLists.contentBangumiList.list,
            contentMovieList: entityLists.contentMovieList.list,
            contentGameList: entityLists.contentGameList.list,
            contentBookList: entityLists.contentBookList.list,
            contentPostList: contentRelatedPostIds,
            contentTweetList: contentRelatedTweetIds,
            contentEventList: entityLists.contentEventList.list,
            contentVoteList: entityLists.contentVoteList.list,
            contentSeriesSortList: Array.isArray(
              normalizedPayload.contentSeriesSortList
            )
              ? normalizedPayload.contentSeriesSortList
              : [],
            importMeta: {
              importedAt: new Date().toISOString(),
              sourceIdentifier: validatedInput.sourceIdentifier,
              htmlDiscoveredMediaCount: htmlExtractionResult.mediaList.length,
              overwrite: Boolean(existingPost)
            }
          }
        )

        await updateImportJob(importJob._id, {
          stage: 'finalize',
          status: 'success',
          sourcePayload: normalizedPayload,
          sourcePayloadHash: sourceHash,
          resultPostId: savedPost._id,
          finishedAt: new Date(),
          warnings: [],
          errors: []
        })

        return {
          postId: String(savedPost._id),
          editorPath: `/multilingual-admin/post/editor/${savedPost._id}`,
          duplicated: Boolean(existingPost),
          importJobId: String(importJob._id)
        }
      } catch (error) {
        await updateImportJob(importJob._id, {
          status: 'failed',
          finishedAt: new Date(),
          errors: [error.message || '导入失败']
        })
        throw error
      }
    }
  )
}

async function listImportJobs(query) {
  const page = query && query.page ? Number(query.page) : 1
  const size = query && query.size ? Number(query.size) : 20
  const filters = {}

  if (query && query.languageCode) {
    filters.languageCode = query.languageCode
  }

  if (query && query.status) {
    filters.status = query.status
  }

  return importJobsUtils.findPage(filters, null, page, size, {
    sort: { createdAt: -1 },
    lean: true
  })
}

module.exports = {
  importPost,
  listImportJobs
}
