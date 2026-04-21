const db = require('../mongodb')
const env = require('../config/env')
const HttpError = require('../utils/httpError')
const { hashObject, sha256 } = require('../utils/hash')
const { normalizeText } = require('../../common/utils/object')
const { extractTranslatableHtmlSegments, applyTranslatedHtmlSegments, validateHtmlContent } = require('../utils/html')
const { getEntityConfig } = require('./entityRegistry')
const { TRANSLATION_STATUS } = require('../../common/constants')
const optionsService = require('./optionsService')

let genAIModulePromise = null

function buildFieldKind(entityType, fieldPath) {
  return `${entityType}:${fieldPath}`
}

async function loadGenAIModule() {
  if (!genAIModulePromise) {
    genAIModulePromise = import('@google/genai')
  }
  return genAIModulePromise
}

async function getAIClient() {
  const { GoogleGenAI } = await loadGenAIModule()
  const options = {}

  if (env.GEMINI_API_KEY) {
    options.apiKey = env.GEMINI_API_KEY
  }
  if (env.AI_GATEWAY_URL) {
    options.httpOptions = { baseUrl: env.AI_GATEWAY_URL }
  }

  if (!options.apiKey && !options.httpOptions) {
    throw new HttpError(400, '未配置 GEMINI_API_KEY 或 AI_GATEWAY_URL')
  }

  return new GoogleGenAI(options)
}

async function saveTranslationLog(payload) {
  return db.utils.aiTranslationLogs.save(payload)
}

async function findEntity(entityType, entityId) {
  const config = getEntityConfig(entityType)
  const doc = await db.utils[config.modelName].findOne({ _id: entityId })
  if (!doc) {
    throw new HttpError(404, '翻译目标不存在')
  }
  return { config, doc }
}

async function getApprovedMemory(sourceText, languageCode, fieldKind) {
  const sourceTextHash = sha256(normalizeText(sourceText))
  return db.utils.translationMemories.findOne({
    approved: true,
    fieldKind,
    sourceTextHash,
    targetLanguageCode: languageCode
  })
}

async function upsertMemory(sourceText, translatedText, languageCode, fieldKind) {
  const sourceTextHash = sha256(normalizeText(sourceText))
  return db.utils.translationMemories.upsertOne(
    {
      sourceTextHash,
      targetLanguageCode: languageCode,
      fieldKind
    },
    {
      sourceTextHash,
      sourceText,
      targetLanguageCode: languageCode,
      fieldKind,
      translatedText,
      provider: 'google-genai',
      model: env.GEMINI_MODEL,
      approved: false
    }
  )
}

function chunkSegments(segments, maxSegments, maxChars) {
  const chunks = []
  let currentChunk = []
  let currentChars = 0

  for (const segment of segments) {
    const nextChars = currentChars + segment.sourceText.length
    if (
      currentChunk.length > 0 &&
      (currentChunk.length >= maxSegments || nextChars > maxChars)
    ) {
      chunks.push(currentChunk)
      currentChunk = []
      currentChars = 0
    }

    currentChunk.push(segment)
    currentChars += segment.sourceText.length
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk)
  }

  return chunks
}

async function requestTranslationBatch({ entityType, entityId, fieldPath, languageCode, segments, operatorAdminId, sourceHash }) {
  const optionsMap = await optionsService.getOptionMap()
  const aiClient = await getAIClient()
  const { FunctionCallingConfigMode } = await loadGenAIModule()

  const translationDeclaration = {
    name: 'submit_translation_segments',
    description: 'Submit translated segments for the provided segment list.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              segmentId: { type: 'string' },
              translatedText: { type: 'string' }
            },
            required: ['segmentId', 'translatedText']
          }
        }
      },
      required: ['items']
    }
  }

  const summaryDeclaration = {
    name: 'submit_entity_translation_summary',
    description: 'Optional translation summary for audit.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        entityType: { type: 'string' },
        entityId: { type: 'string' },
        fieldPath: { type: 'string' },
        notes: { type: 'string' }
      },
      required: ['entityType', 'entityId', 'fieldPath', 'notes']
    }
  }

  const prompt = [
    `Target language code: ${languageCode}`,
    'Translate every segment faithfully.',
    'Do not translate URLs or identifiers.',
    'Return tool calls only.',
    JSON.stringify({ segments })
  ].join('\n\n')

  const response = await aiClient.models.generateContent({
    model: env.GEMINI_MODEL,
    contents: prompt,
    config: {
      systemInstruction: optionsMap.translationSystemPrompt,
      temperature: 0.2,
      tools: [
        {
          functionDeclarations: [translationDeclaration, summaryDeclaration]
        }
      ],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY,
          allowedFunctionNames: ['submit_translation_segments', 'submit_entity_translation_summary']
        }
      }
    }
  })

  const functionCalls = response.functionCalls || []
  const submitCall = functionCalls.find(item => item.name === 'submit_translation_segments')
  const summaryCall = functionCalls.find(item => item.name === 'submit_entity_translation_summary')

  if (!submitCall?.args?.items || !Array.isArray(submitCall.args.items)) {
    await saveTranslationLog({
      entityType,
      entityId,
      fieldPath,
      languageCode,
      sourceHash,
      requestPayload: { segments },
      responsePayload: response,
      normalizedResult: {},
      provider: 'google-genai',
      model: env.GEMINI_MODEL,
      promptVersion: 'v1',
      tokenUsage: response.usageMetadata || {},
      success: false,
      errorMessage: 'AI 未返回 submit_translation_segments 工具调用',
      operatorAdminId
    })
    throw new HttpError(502, 'AI 翻译返回格式无效')
  }

  const items = submitCall.args.items.map(item => ({
    segmentId: String(item.segmentId),
    translatedText: String(item.translatedText || '')
  }))

  const expectedIds = new Set(segments.map(item => String(item.segmentId)))
  if (items.length !== segments.length || items.some(item => !expectedIds.has(item.segmentId))) {
    throw new HttpError(502, 'AI 翻译片段数量或 segmentId 不匹配')
  }

  await saveTranslationLog({
    entityType,
    entityId,
    fieldPath,
    languageCode,
    sourceHash,
    requestPayload: { segments },
    responsePayload: {
      functionCalls,
      summary: summaryCall?.args || null,
      text: response.text
    },
    normalizedResult: { items },
    provider: 'google-genai',
    model: env.GEMINI_MODEL,
    promptVersion: 'v1',
    tokenUsage: response.usageMetadata || {},
    success: true,
    errorMessage: '',
    operatorAdminId
  })

  return items
}

async function translateSegments({ entityType, entityId, fieldPath, languageCode, segments, operatorAdminId, sourceHash }) {
  const optionsMap = await optionsService.getOptionMap()
  const fieldKind = buildFieldKind(entityType, fieldPath)
  const completed = []
  const pending = []

  for (const segment of segments) {
    const memory = await getApprovedMemory(segment.sourceText, languageCode, fieldKind)
    if (memory) {
      completed.push({
        segmentId: segment.segmentId,
        translatedText: memory.translatedText
      })
      continue
    }
    pending.push(segment)
  }

  const chunks = chunkSegments(
    pending,
    optionsMap.translationHtmlBatchMaxSegments || 80,
    optionsMap.translationHtmlBatchMaxChars || 6000
  )

  for (const chunk of chunks) {
    const result = await requestTranslationBatch({
      entityType,
      entityId,
      fieldPath,
      languageCode,
      operatorAdminId,
      segments: chunk,
      sourceHash
    })
    completed.push(...result)

    for (const item of result) {
      const sourceSegment = chunk.find(segment => String(segment.segmentId) === String(item.segmentId))
      if (sourceSegment) {
        await upsertMemory(sourceSegment.sourceText, item.translatedText, languageCode, fieldKind)
      }
    }
  }

  return completed.sort((left, right) => Number(left.segmentId) - Number(right.segmentId))
}

async function translateField({ entityType, entityId, fieldPath, languageCode, sourceText, operatorAdminId }) {
  const { config, doc } = await findEntity(entityType, entityId)
  const segments = [{ segmentId: '0', sourceText }]
  const translatedItems = await translateSegments({
    entityType,
    entityId,
    fieldPath,
    languageCode,
    operatorAdminId,
    segments,
    sourceHash: doc.sourceHash
  })

  const translatedText = translatedItems[0]?.translatedText || ''
  doc.set(fieldPath, translatedText)
  doc.translationStatus = TRANSLATION_STATUS.AI_DRAFT
  await doc.save()

  return {
    doc,
    translatedText
  }
}

async function translateHtmlField({ entityType, entityId, fieldPath, languageCode, html, operatorAdminId }) {
  const { doc } = await findEntity(entityType, entityId)
  const extraction = extractTranslatableHtmlSegments(html)
  const translatedItems = await translateSegments({
    entityType,
    entityId,
    fieldPath,
    languageCode,
    operatorAdminId,
    segments: extraction.segments,
    sourceHash: doc.sourceHash
  })
  const translatedHtml = validateHtmlContent(
    applyTranslatedHtmlSegments(extraction.sanitizedHtml, translatedItems)
  )
  doc.set(fieldPath, translatedHtml)
  doc.translationStatus = TRANSLATION_STATUS.AI_DRAFT
  await doc.save()

  return {
    doc,
    translatedHtml,
    translatedItems
  }
}

async function translateAllFields({ entityType, entityId, languageCode, fieldPaths, operatorAdminId }) {
  const { config, doc } = await findEntity(entityType, entityId)
  const results = []

  for (const fieldPath of fieldPaths) {
    const value = doc.get(fieldPath)
    if (typeof value === 'string' && value.includes('<') && value.includes('>')) {
      const result = await translateHtmlField({
        entityType,
        entityId,
        fieldPath,
        languageCode,
        html: value,
        operatorAdminId
      })
      results.push({ fieldPath, value: result.translatedHtml })
      continue
    }

    if (typeof value === 'string') {
      const result = await translateField({
        entityType,
        entityId,
        fieldPath,
        languageCode,
        sourceText: value,
        operatorAdminId
      })
      results.push({ fieldPath, value: result.translatedText })
      continue
    }

    if (Array.isArray(value)) {
      const titleItems = value
        .map((item, index) => ({
          item,
          index,
          sourceText: item?.title
        }))
        .filter(item => typeof item.sourceText === 'string' && item.sourceText.trim())

      if (titleItems.length > 0) {
        const translatedItems = await translateSegments({
          entityType,
          entityId,
          fieldPath,
          languageCode,
          operatorAdminId,
          sourceHash: doc.sourceHash,
          segments: titleItems.map(item => ({
            segmentId: String(item.index),
            sourceText: item.sourceText
          }))
        })
        const nextValue = [...value]
        for (const translatedItem of translatedItems) {
          const index = Number(translatedItem.segmentId)
          nextValue[index] = {
            ...nextValue[index],
            title: translatedItem.translatedText
          }
        }
        doc.set(fieldPath, nextValue)
        doc.translationStatus = TRANSLATION_STATUS.AI_DRAFT
        await doc.save()
        results.push({ fieldPath, value: nextValue })
      }
    }
  }

  return { doc, results }
}

module.exports = {
  translateAllFields,
  translateField,
  translateHtmlField
}