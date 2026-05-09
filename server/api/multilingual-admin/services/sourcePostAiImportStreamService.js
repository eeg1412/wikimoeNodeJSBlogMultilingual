const mongoose = require('mongoose')
const { normalizeLanguageCode } = require('../../../utils/language')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')
const deepSeekTranslationService = require('./deepSeekTranslationService')
const coverImageTranslationService = require('./coverImageTranslationService')
const translationPostService = require('./translationPostService')

function normalizePrompt(value) {
  return String(value || '')
    .trim()
    .slice(0, 6000)
}

function createRequestContext(input) {
  return {
    _id: new mongoose.Types.ObjectId().toString(),
    source: {
      postId: input.sourceId,
      languageCode: input.sourceLanguageCode
    },
    target: {
      languageCode: input.targetLanguageCode
    }
  }
}

function appendCoverImageResultToStreamData(data, coverResult, registry) {
  const nextData = {
    ...data,
    coverImagePreviewEntries: Array.isArray(data.coverImagePreviewEntries)
      ? data.coverImagePreviewEntries.slice()
      : [],
    coverImageArtifacts: Array.isArray(data.coverImageArtifacts)
      ? data.coverImageArtifacts.slice()
      : [],
    coverImageWarnings: Array.isArray(data.coverImageWarnings)
      ? data.coverImageWarnings.slice()
      : []
  }

  if (coverResult?.previewEntry) {
    nextData.coverImagePreviewEntries.push(coverResult.previewEntry)
  }
  if (Array.isArray(coverResult?.warnings)) {
    nextData.coverImageWarnings.push(
      ...coverResult.warnings.map(warning => {
        return warning?.message || String(warning || '')
      })
    )
  }

  const snapshot = coverImageTranslationService.buildRegistrySnapshot(registry)
  nextData.coverImageArtifacts = snapshot.coverImageArtifacts
  return nextData
}

function createEmptyTranslatedResult() {
  return {
    payload: {
      entries: []
    },
    model: '',
    usage: null,
    requestId: new mongoose.Types.ObjectId().toString(),
    coverImagePreviewEntries: [],
    coverImageArtifacts: [],
    coverImageWarnings: []
  }
}

function parseInput(body = {}) {
  const sourceId = String(body.sourceId || '').trim()
  if (!mongoose.Types.ObjectId.isValid(sourceId)) {
    throw new ApiError(
      ERROR_CODES.SOURCE_ID_INVALID,
      undefined,
      'sourceId',
      400
    )
  }

  const sourceLanguageCode = normalizeLanguageCode(body.sourceLanguageCode)
  if (!sourceLanguageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      undefined,
      'sourceLanguageCode',
      400
    )
  }

  const targetLanguageCode = normalizeLanguageCode(body.targetLanguageCode)
  if (!targetLanguageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      undefined,
      'targetLanguageCode',
      400
    )
  }

  const entries = Array.isArray(body.entries) ? body.entries : []
  const translateCoverImage = body.translateCoverImage !== false
  const allowEmptyEntries = body.allowEmptyEntries === true
  if (entries.length === 0 && !translateCoverImage && !allowEmptyEntries) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '请至少选择一个翻译条目',
      'entries',
      400
    )
  }

  return {
    sourceId,
    sourceLanguageCode,
    targetLanguageCode,
    prompt: normalizePrompt(body.prompt),
    entries,
    translateCoverImage,
    allowEmptyEntries,
    skipUsageLog: body.skipUsageLog === true,
    searchOfficialTermTranslations: body.searchOfficialTermTranslations === true
  }
}

async function translateSourcePostAiImportEntriesStream(
  body = {},
  handlers = {}
) {
  const input = parseInput(body)
  const previewContext =
    await translationPostService.getSourcePostAiImportPreviewContext({
      sourceId: input.sourceId,
      sourceLanguageCode: input.sourceLanguageCode,
      targetLanguageCode: input.targetLanguageCode
    })

  let data = null
  if (input.entries.length > 0) {
    data = await deepSeekTranslationService.translateContentEntriesStream(
      {
        contentId: String(previewContext.targetPost?._id || input.sourceId),
        contentType: 'sourcePostImport',
        sourceLanguageCode: input.sourceLanguageCode,
        targetLanguageCode: input.targetLanguageCode,
        prompt: input.prompt,
        skipUsageLog: input.skipUsageLog,
        searchOfficialTermTranslations: input.searchOfficialTermTranslations,
        entries: input.entries
      },
      handlers
    )
  } else {
    if (handlers.onStatus) {
      handlers.onStatus({ message: '未选择正文条目，跳过正文直译阶段' })
    }
    data = createEmptyTranslatedResult()
  }

  if (input.translateCoverImage) {
    if (handlers.onStatus) {
      handlers.onStatus({ message: '正在处理封面图 AI 翻译' })
    }
    const registry = coverImageTranslationService.createCoverImageRegistry()
    const coverResult =
      await coverImageTranslationService.processCoverImageTranslation({
        job: createRequestContext(input),
        registry,
        sourcePost: previewContext.sourcePost,
        targetPost: previewContext.targetPost,
        previewEntries: Array.isArray(data.payload?.entries)
          ? data.payload.entries
          : [],
        sourceLanguageCode: input.sourceLanguageCode,
        targetLanguageCode: input.targetLanguageCode
      })
    data = appendCoverImageResultToStreamData(data, coverResult, registry)
  }

  if (handlers.onResult) {
    handlers.onResult(data)
  }
  return data
}

function normalizeCoverBatchItem(item = {}, index) {
  const sourceId = String(item.sourceId || '').trim()
  if (!mongoose.Types.ObjectId.isValid(sourceId)) {
    throw new ApiError(
      ERROR_CODES.SOURCE_ID_INVALID,
      undefined,
      `items[${index}].sourceId`,
      400
    )
  }

  const targetLanguageCode = normalizeLanguageCode(
    item.targetLanguageCode || item.languageCode
  )
  if (!targetLanguageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      undefined,
      `items[${index}].targetLanguageCode`,
      400
    )
  }

  let requestKey = String(item.requestKey || '').trim()
  if (!requestKey) {
    requestKey = `${targetLanguageCode}:${sourceId}`
  }

  const previewEntries = Array.isArray(item.previewEntries)
    ? item.previewEntries.filter(Boolean)
    : []

  return {
    requestKey,
    sourceId,
    targetLanguageCode,
    previewEntries
  }
}

function parseCoverBatchInput(body = {}) {
  const sourceLanguageCode = normalizeLanguageCode(body.sourceLanguageCode)
  if (!sourceLanguageCode) {
    throw new ApiError(
      ERROR_CODES.LANGUAGE_CODE_UNSUPPORTED,
      undefined,
      'sourceLanguageCode',
      400
    )
  }

  const items = Array.isArray(body.items) ? body.items : []
  if (items.length === 0) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      '请至少提供一个封面图翻译任务',
      'items',
      400
    )
  }

  return {
    sourceLanguageCode,
    items: items.map((item, index) => {
      return normalizeCoverBatchItem(item, index)
    })
  }
}

function normalizeCoverWarningMessages(warnings) {
  if (!Array.isArray(warnings)) {
    return []
  }
  return warnings
    .map(warning => {
      if (warning && typeof warning.message === 'string') {
        return warning.message.trim()
      }
      return String(warning || '').trim()
    })
    .filter(Boolean)
}

function buildItemCoverArtifacts(snapshotArtifacts, coverResult) {
  const artifactIdSet = new Set()
  if (coverResult?.previewEntry?.artifactId) {
    artifactIdSet.add(String(coverResult.previewEntry.artifactId))
  }
  if (coverResult?.artifact?.artifactId) {
    artifactIdSet.add(String(coverResult.artifact.artifactId))
  }

  const artifactList = []
  snapshotArtifacts.forEach(artifact => {
    const artifactId = String(artifact?.artifactId || '')
    if (artifactIdSet.has(artifactId)) {
      artifactList.push(artifact)
    }
  })

  if (coverResult?.artifact?.artifactId) {
    const artifactId = String(coverResult.artifact.artifactId)
    const exists = artifactList.some(artifact => {
      return String(artifact?.artifactId || '') === artifactId
    })
    if (!exists) {
      artifactList.push(coverResult.artifact)
    }
  }

  return artifactList
}

async function buildCoverBatchTasks(input) {
  const tasks = []
  for (const item of input.items) {
    const previewContext =
      await translationPostService.getSourcePostAiImportPreviewContext({
        sourceId: item.sourceId,
        sourceLanguageCode: input.sourceLanguageCode,
        targetLanguageCode: item.targetLanguageCode
      })
    tasks.push({
      requestKey: item.requestKey,
      sourceId: item.sourceId,
      job: createRequestContext({
        sourceId: item.sourceId,
        sourceLanguageCode: input.sourceLanguageCode,
        targetLanguageCode: item.targetLanguageCode
      }),
      sourcePost: previewContext.sourcePost,
      targetPost: previewContext.targetPost,
      previewEntries: item.previewEntries,
      sourceLanguageCode: input.sourceLanguageCode,
      targetLanguageCode: item.targetLanguageCode
    })
  }
  return tasks
}

async function translateSourcePostAiImportCoverImages(body = {}) {
  const input = parseCoverBatchInput(body)
  const registry = coverImageTranslationService.createCoverImageRegistry()
  const tasks = await buildCoverBatchTasks(input)
  const batchResult =
    await coverImageTranslationService.processCoverImageTranslationBatch({
      registry,
      tasks
    })
  const snapshot = coverImageTranslationService.buildRegistrySnapshot(registry)
  const items = batchResult.results.map(item => {
    const previewEntries = []
    if (item.coverResult?.previewEntry) {
      previewEntries.push(item.coverResult.previewEntry)
    }

    return {
      requestKey: item.task.requestKey,
      sourceId: item.task.sourceId,
      languageCode: item.task.targetLanguageCode,
      targetLanguageCode: item.task.targetLanguageCode,
      coverImagePreviewEntries: previewEntries,
      coverImageArtifacts: buildItemCoverArtifacts(
        snapshot.coverImageArtifacts,
        item.coverResult
      ),
      coverImageWarnings: normalizeCoverWarningMessages(
        item.coverResult?.warnings
      )
    }
  })

  return {
    items,
    coverImageArtifacts: snapshot.coverImageArtifacts,
    coverImageGenerationMap: snapshot.coverImageGenerationMap,
    coverImageRecognitionMap: snapshot.coverImageRecognitionMap,
    dedupe: {
      taskCount: batchResult.taskCount,
      groupCount: batchResult.groupCount,
      duplicateTitleCount: batchResult.duplicateTitleCount
    }
  }
}

module.exports = {
  translateSourcePostAiImportCoverImages,
  translateSourcePostAiImportEntriesStream
}
