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
  if (entries.length === 0 && !translateCoverImage) {
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
    skipUsageLog: body.skipUsageLog === true
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

module.exports = {
  translateSourcePostAiImportEntriesStream
}
