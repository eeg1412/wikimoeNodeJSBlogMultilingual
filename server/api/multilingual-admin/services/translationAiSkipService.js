const relationService = require('./relationService')
const translationPostService = require('./translationPostService')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')

const SUPPORTED_CONTENT_TYPES = new Set(['post', 'relation'])

function parseInput(body = {}) {
  const contentType = String(body.contentType || '').trim()
  if (!SUPPORTED_CONTENT_TYPES.has(contentType)) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      'contentType must be post or relation',
      'contentType',
      400
    )
  }

  if (!Object.prototype.hasOwnProperty.call(body, 'aiTranslationSkip')) {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      'aiTranslationSkip is required',
      'aiTranslationSkip',
      400
    )
  }

  if (typeof body.aiTranslationSkip !== 'boolean') {
    throw new ApiError(
      ERROR_CODES.CONTENT_FIELD_INVALID,
      'aiTranslationSkip must be boolean',
      'aiTranslationSkip',
      400
    )
  }

  const id = String(body.id || '').trim()
  const languageCode = String(body.languageCode || '').trim()
  const collectionName = String(body.collectionName || '').trim()

  return {
    contentType,
    id,
    languageCode,
    collectionName,
    aiTranslationSkip: body.aiTranslationSkip
  }
}

async function updateTranslationAiSkip(body = {}) {
  const input = parseInput(body)

  if (input.contentType === 'post') {
    return await translationPostService.updateTranslationPostAiSkip({
      id: input.id,
      languageCode: input.languageCode,
      aiTranslationSkip: input.aiTranslationSkip
    })
  }

  return await relationService.updateRelation(
    {
      collectionName: input.collectionName,
      id: input.id,
      languageCode: input.languageCode,
      payload: {
        aiTranslationSkip: input.aiTranslationSkip
      }
    },
    {
      skipContentRefresh: true
    }
  )
}

module.exports = {
  updateTranslationAiSkip
}
