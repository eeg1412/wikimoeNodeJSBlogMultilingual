const http = require('http')
const https = require('https')
const {
  ApiError,
  ERROR_CODES
} = require('../../../utils/multilingualAdminResponse')
const {
  applyGeminiThinkingConfig,
  buildGeminiNativeGenerateContentUrl,
  buildTextPart,
  extractTextFromGeminiNativeResponse,
  sendGeminiNativeGenerateContentRequest
} = require('./geminiNativeApiService')

function normalizeTrimmedString(value, maxLength = 12000) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  return String(value).trim().slice(0, maxLength)
}

function getProviderCode(settings = {}) {
  return normalizeTrimmedString(settings.provider, 40).toLowerCase()
}

function getProviderLabel(settings = {}) {
  const provider = getProviderCode(settings)
  if (provider === 'gemini') {
    return 'Gemini'
  }
  return 'DeepSeek'
}

function getProviderErrorField(settings = {}) {
  const provider = getProviderCode(settings)
  if (provider === 'gemini') {
    return 'geminiText'
  }
  return 'deepSeek'
}

function isDeepSeekThinkingEnabled(settings = {}) {
  return (
    getProviderCode(settings) === 'deepseek' &&
    normalizeTrimmedString(settings.deepSeekThinkingType, 40) === 'enabled'
  )
}

function buildDeepSeekResponseFormat(settings = {}) {
  if (isDeepSeekThinkingEnabled(settings)) {
    return { type: 'text' }
  }
  return { type: 'json_object' }
}

function buildDeepSeekChatCompletionUrl(settings = {}) {
  const baseUrl = normalizeTrimmedString(
    settings.deepSeekBaseUrl || settings.baseUrl,
    1000
  )
  if (!baseUrl) {
    throw new ApiError(
      ERROR_CODES.AI_PROVIDER_CONFIG_REQUIRED,
      'DeepSeek Base URL 不能为空',
      'deepSeekBaseUrl',
      400
    )
  }

  try {
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')
    if (/\/chat\/completions$/i.test(normalizedBaseUrl)) {
      throw new ApiError(
        ERROR_CODES.AI_PROVIDER_CONFIG_REQUIRED,
        'DeepSeek Base URL 只填写到服务地址，不要包含 /chat/completions',
        'deepSeekBaseUrl',
        400
      )
    }
    const url = new URL(normalizedBaseUrl + '/chat/completions')
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('unsupported protocol')
    }
    return url
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    throw new ApiError(
      ERROR_CODES.AI_PROVIDER_CONFIG_REQUIRED,
      'DeepSeek Base URL 格式不正确',
      'deepSeekBaseUrl',
      400
    )
  }
}

function buildDeepSeekHeaders(settings, requestText, accept = '') {
  const headers = {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(requestText)
  }
  if (accept) {
    headers.Accept = accept
  }

  if (settings.deepSeekUseCloudflareAiGateway === true) {
    headers['cf-aig-authorization'] = `Bearer ${settings.deepSeekApiKey}`
    return headers
  }

  headers.Authorization = `Bearer ${settings.deepSeekApiKey}`
  return headers
}

function createTranslationCancelledError(reason, retryable = true) {
  const message = String(reason || '').trim() || 'AI 翻译已停止'
  return new ApiError(
    ERROR_CODES.AI_TRANSLATION_CANCELLED,
    message,
    'translation',
    499,
    { retryable }
  )
}

function isCancellationRequested(options = {}) {
  return options.cancellation?.isCancelled === true
}

function throwIfCancellationRequested(options = {}) {
  if (!isCancellationRequested(options)) {
    return
  }
  throw createTranslationCancelledError(
    options.cancellation?.reason,
    options.cancellation?.retryable !== false
  )
}

function bindCancellation(request, options = {}) {
  const cancellation = options.cancellation
  if (!cancellation || typeof cancellation.onCancel !== 'function') {
    return () => {}
  }

  return cancellation.onCancel(reason => {
    request.destroy(
      createTranslationCancelledError(reason, cancellation.retryable !== false)
    )
  })
}

function createProviderResponseInterruptedError(
  settings,
  message,
  error = null
) {
  const providerLabel = getProviderLabel(settings)
  const detailMessage = error?.message
    ? `${message}：${error.message}`
    : message
  return new ApiError(
    ERROR_CODES.AI_TRANSLATION_FAILED,
    detailMessage,
    getProviderErrorField(settings),
    502,
    { retryable: true }
  )
}

function parseSseBlock(block) {
  const dataLines = block
    .split(/\r?\n/)
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice(5).trimStart())
  if (dataLines.length === 0) {
    return null
  }
  return dataLines.join('\n')
}

function findSseBoundary(buffer) {
  const lfIndex = buffer.indexOf('\n\n')
  const crlfIndex = buffer.indexOf('\r\n\r\n')
  if (lfIndex < 0 && crlfIndex < 0) {
    return { index: -1, length: 0 }
  }
  if (lfIndex < 0) {
    return { index: crlfIndex, length: 4 }
  }
  if (crlfIndex < 0) {
    return { index: lfIndex, length: 2 }
  }
  if (lfIndex < crlfIndex) {
    return { index: lfIndex, length: 2 }
  }
  return { index: crlfIndex, length: 4 }
}

function collectNonStreamResponse(settings, response, resolve, reject) {
  const chunks = []
  let responseEnded = false
  response.on('data', chunk => {
    chunks.push(chunk)
  })
  response.on('end', () => {
    responseEnded = true
    const responseText = Buffer.concat(chunks).toString('utf8')
    let responseData = null
    try {
      responseData = JSON.parse(responseText)
    } catch (error) {
      responseData = { rawText: responseText }
    }
    resolve({
      statusCode: response.statusCode,
      data: responseData
    })
  })
  response.on('aborted', () => {
    reject(
      createProviderResponseInterruptedError(
        settings,
        `${getProviderLabel(settings)} 错误响应在读取完成前被上游中断`
      )
    )
  })
  response.on('error', error => {
    reject(
      createProviderResponseInterruptedError(
        settings,
        `${getProviderLabel(settings)} 错误响应读取失败`,
        error
      )
    )
  })
  response.on('close', () => {
    if (responseEnded) {
      return
    }
    reject(
      createProviderResponseInterruptedError(
        settings,
        `${getProviderLabel(settings)} 错误响应在读取完成前关闭`
      )
    )
  })
}

function requestDeepSeekJson(url, requestBody, settings, options = {}) {
  throwIfCancellationRequested(options)
  const requestText = JSON.stringify(requestBody)
  const client = url.protocol === 'http:' ? http : https
  const timeout = Number(settings.deepSeekTimeoutSeconds || 120) * 1000

  return new Promise((resolve, reject) => {
    let unbindCancellation = () => {}
    const request = client.request(
      url,
      {
        method: 'POST',
        headers: buildDeepSeekHeaders(settings, requestText),
        timeout
      },
      response => {
        const chunks = []
        response.on('data', chunk => {
          chunks.push(chunk)
        })
        response.on('end', () => {
          unbindCancellation()
          const responseText = Buffer.concat(chunks).toString('utf8')
          let responseData = null
          try {
            responseData = JSON.parse(responseText)
          } catch (error) {
            resolve({
              statusCode: response.statusCode,
              data: {
                rawText: responseText
              },
              parseError: true
            })
            return
          }

          resolve({
            statusCode: response.statusCode,
            data: responseData
          })
        })
      }
    )

    unbindCancellation = bindCancellation(request, options)
    if (isCancellationRequested(options)) {
      request.destroy(
        createTranslationCancelledError(
          options.cancellation?.reason,
          options.cancellation?.retryable !== false
        )
      )
      return
    }

    request.on('timeout', () => {
      request.destroy(
        new ApiError(
          ERROR_CODES.AI_TRANSLATION_FAILED,
          `${getProviderLabel(settings)} 请求超时`,
          getProviderErrorField(settings),
          504
        )
      )
    })
    request.on('error', error => {
      unbindCancellation()
      if (error && error.name === 'ApiError') {
        reject(error)
        return
      }
      reject(
        new ApiError(
          ERROR_CODES.AI_TRANSLATION_FAILED,
          error?.message || `${getProviderLabel(settings)} 请求失败`,
          getProviderErrorField(settings),
          502
        )
      )
    })
    request.write(requestText)
    request.end()
  })
}

function requestDeepSeekStream(
  url,
  requestBody,
  settings,
  handlers = {},
  options = {}
) {
  throwIfCancellationRequested(options)
  const requestText = JSON.stringify(requestBody)
  const client = url.protocol === 'http:' ? http : https
  const timeout = Number(settings.deepSeekTimeoutSeconds || 300) * 1000

  return new Promise((resolve, reject) => {
    let unbindCancellation = () => {}
    let settled = false
    function resolveOnce(value) {
      if (settled) {
        return
      }
      settled = true
      unbindCancellation()
      resolve(value)
    }
    function rejectOnce(error) {
      if (settled) {
        return
      }
      settled = true
      unbindCancellation()
      reject(error)
    }
    const request = client.request(
      url,
      {
        method: 'POST',
        headers: buildDeepSeekHeaders(
          settings,
          requestText,
          'text/event-stream'
        ),
        timeout
      },
      response => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          collectNonStreamResponse(settings, response, resolveOnce, rejectOnce)
          return
        }

        if (handlers.onStatus) {
          handlers.onStatus({ message: '已连接 AI 服务' })
        }

        const streamChunks = []
        let buffer = ''
        let content = ''
        let reasoningContent = ''
        let usage = {}
        let responseId = ''
        let responseModel = settings.deepSeekModel || settings.model
        let finishReason = ''
        let responseEnded = false
        let responseStreamError = null

        function rejectStream(error) {
          responseStreamError = error
          rejectOnce(error)
        }

        function handleDataText(dataText) {
          if (!dataText || dataText === '[DONE]') {
            return
          }

          let chunkData = null
          try {
            chunkData = JSON.parse(dataText)
          } catch (error) {
            throw new ApiError(
              ERROR_CODES.AI_TRANSLATION_FAILED,
              `${getProviderLabel(settings)} 流式返回解析失败`,
              getProviderErrorField(settings),
              502
            )
          }

          streamChunks.push(chunkData)
          if (chunkData.id && !responseId) {
            responseId = chunkData.id
          }
          if (chunkData.model) {
            responseModel = chunkData.model
          }
          if (chunkData.usage) {
            usage = chunkData.usage
          }

          const choice = chunkData.choices?.[0] || {}
          if (choice.finish_reason) {
            finishReason = choice.finish_reason
          }
          const delta = choice.delta || {}
          const contentDelta = delta.content || ''
          const reasoningDelta = delta.reasoning_content || ''
          if (contentDelta) {
            content += contentDelta
          }
          if (reasoningDelta) {
            reasoningContent += reasoningDelta
          }
          if (handlers.onChunk && (contentDelta || reasoningDelta)) {
            handlers.onChunk({ contentDelta, reasoningDelta })
          }
        }

        function consumeBuffer() {
          let boundary = findSseBoundary(buffer)
          while (boundary.index >= 0) {
            const boundaryIndex = boundary.index
            const block = buffer.slice(0, boundaryIndex)
            buffer = buffer.slice(boundaryIndex + boundary.length)
            const dataText = parseSseBlock(block)
            handleDataText(dataText)
            boundary = findSseBoundary(buffer)
          }
        }

        response.on('data', chunk => {
          try {
            buffer += chunk.toString('utf8')
            consumeBuffer()
          } catch (error) {
            responseStreamError = error
            request.destroy(error)
          }
        })
        response.on('aborted', () => {
          rejectStream(
            createProviderResponseInterruptedError(
              settings,
              `${getProviderLabel(settings)} 流式连接在完成前被上游中断`
            )
          )
        })
        response.on('error', error => {
          rejectStream(
            createProviderResponseInterruptedError(
              settings,
              `${getProviderLabel(settings)} 流式连接发生错误`,
              error
            )
          )
        })
        response.on('close', () => {
          if (responseEnded) {
            return
          }
          rejectStream(
            responseStreamError ||
              createProviderResponseInterruptedError(
                settings,
                `${getProviderLabel(settings)} 流式连接在完成前关闭`
              )
          )
        })
        response.on('end', () => {
          try {
            responseEnded = true
            if (buffer.trim()) {
              const dataText = parseSseBlock(buffer)
              handleDataText(dataText)
            }
            resolveOnce({
              statusCode: response.statusCode,
              data: {
                id: responseId,
                model: responseModel,
                object: 'chat.completion.stream',
                choices: [
                  {
                    finish_reason: finishReason || null,
                    message: {
                      content,
                      reasoning_content: reasoningContent
                    }
                  }
                ],
                usage,
                streamChunks
              }
            })
          } catch (error) {
            rejectOnce(error)
          }
        })
      }
    )

    unbindCancellation = bindCancellation(request, options)
    if (isCancellationRequested(options)) {
      request.destroy(
        createTranslationCancelledError(
          options.cancellation?.reason,
          options.cancellation?.retryable !== false
        )
      )
      return
    }

    request.on('timeout', () => {
      request.destroy(
        new ApiError(
          ERROR_CODES.AI_TRANSLATION_FAILED,
          `${getProviderLabel(settings)} 请求超时`,
          getProviderErrorField(settings),
          504
        )
      )
    })
    request.on('error', error => {
      if (error && error.name === 'ApiError') {
        rejectOnce(error)
        return
      }
      rejectOnce(
        new ApiError(
          ERROR_CODES.AI_TRANSLATION_FAILED,
          error?.message || `${getProviderLabel(settings)} 请求失败`,
          getProviderErrorField(settings),
          502
        )
      )
    })
    request.write(requestText)
    request.end()
  })
}

function buildGeminiContents(messages = []) {
  const contents = []
  messages.forEach(message => {
    if (!message || message.role === 'system') {
      return
    }
    const role = message.role === 'assistant' ? 'model' : 'user'
    const contentText = normalizeTrimmedString(message.content, 200000)
    if (!contentText) {
      return
    }
    const current = contents[contents.length - 1]
    if (current && current.role === role) {
      current.parts.push(buildTextPart(contentText))
      return
    }
    contents.push({
      role,
      parts: [buildTextPart(contentText)]
    })
  })
  if (contents.length > 0) {
    return contents
  }
  return [
    {
      role: 'user',
      parts: [buildTextPart('请根据系统要求返回合法 JSON。')]
    }
  ]
}

function buildGeminiSystemInstruction(messages = []) {
  const systemText = messages
    .filter(message => message?.role === 'system')
    .map(message => normalizeTrimmedString(message.content, 200000))
    .filter(Boolean)
    .join('\n\n')
  if (!systemText) {
    return undefined
  }
  return {
    parts: [buildTextPart(systemText)]
  }
}

function buildJsonRequestBody(settings, messages, options = {}) {
  const configuredMaxTokens = Number(
    options.maxTokens || settings.maxTokens || settings.deepSeekMaxTokens || 0
  )
  if (getProviderCode(settings) === 'gemini') {
    const generationConfig = applyGeminiThinkingConfig(
      {
        responseMimeType: 'application/json'
      },
      settings
    )
    if (Number.isFinite(configuredMaxTokens) && configuredMaxTokens > 0) {
      generationConfig.maxOutputTokens = configuredMaxTokens
    }
    const temperature = Number(settings.temperature)
    if (Number.isFinite(temperature)) {
      generationConfig.temperature = temperature
    }
    if (options.responseJsonSchema) {
      generationConfig.responseJsonSchema = options.responseJsonSchema
    }
    const requestBody = {
      model: settings.model || settings.deepSeekModel,
      contents: buildGeminiContents(messages),
      generationConfig
    }
    const systemInstruction = buildGeminiSystemInstruction(messages)
    if (systemInstruction) {
      requestBody.systemInstruction = systemInstruction
    }
    if (options.useGoogleSearch === true) {
      requestBody.tools = [{ google_search: {} }]
    }
    return {
      requestBody,
      requestUrl: buildGeminiNativeGenerateContentUrl(settings)
    }
  }

  const requestBody = {
    model: settings.deepSeekModel || settings.model,
    messages,
    response_format: buildDeepSeekResponseFormat(settings),
    stream: options.stream === true
  }
  if (Number.isFinite(configuredMaxTokens) && configuredMaxTokens > 0) {
    requestBody.max_tokens = configuredMaxTokens
  }
  if (isDeepSeekThinkingEnabled(settings)) {
    // DeepSeek docs state JSON Output may occasionally return empty content.
    // In thinking mode we keep the JSON contract in prompts and parse locally.
    requestBody.thinking = { type: 'enabled' }
    requestBody.reasoning_effort = settings.deepSeekReasoningEffort
  } else {
    requestBody.thinking = { type: 'disabled' }
    requestBody.temperature =
      settings.deepSeekTemperature || settings.temperature
  }
  if (options.stream === true) {
    requestBody.stream_options = { include_usage: true }
  }
  return {
    requestBody,
    requestUrl: buildDeepSeekChatCompletionUrl(settings)
  }
}

function normalizeGeminiProviderError(settings, error) {
  if (error instanceof ApiError) {
    return error
  }
  const message = error?.message || `${getProviderLabel(settings)} 请求失败`
  return new ApiError(
    ERROR_CODES.AI_TRANSLATION_FAILED,
    message,
    getProviderErrorField(settings),
    error?.status && Number.isInteger(error.status) ? error.status : 502
  )
}

async function requestProviderJson(
  settings,
  requestBody,
  requestUrl,
  options = {}
) {
  const provider = getProviderCode(settings)
  if (provider === 'gemini') {
    let rawResponse = null
    try {
      rawResponse = await sendGeminiNativeGenerateContentRequest(
        settings,
        requestBody,
        requestUrl,
        options
      )
    } catch (error) {
      throw normalizeGeminiProviderError(settings, error)
    }
    const textResult = extractTextFromGeminiNativeResponse(rawResponse)
    return {
      statusCode: 200,
      provider,
      rawResponse,
      contentText: textResult?.text || '',
      reasoningText: '',
      finishReason: '',
      model: rawResponse.modelVersion || rawResponse.model || settings.model,
      requestId: rawResponse.responseId || rawResponse.requestId || '',
      usage: rawResponse.usageMetadata || {},
      parseError: false
    }
  }

  const response = await requestDeepSeekJson(
    requestUrl,
    requestBody,
    settings,
    options
  )
  const rawResponse = response.data || {}
  return {
    statusCode: response.statusCode,
    provider,
    rawResponse,
    contentText: normalizeTrimmedString(
      rawResponse?.choices?.[0]?.message?.content,
      200000
    ),
    reasoningText: normalizeTrimmedString(
      rawResponse?.choices?.[0]?.message?.reasoning_content,
      200000
    ),
    finishReason: normalizeTrimmedString(
      rawResponse?.choices?.[0]?.finish_reason,
      120
    ),
    model: rawResponse.model || settings.deepSeekModel || settings.model,
    requestId: rawResponse.id || '',
    usage: rawResponse.usage || {},
    parseError: response.parseError === true
  }
}

async function requestProviderStream(
  settings,
  requestBody,
  requestUrl,
  handlers = {},
  options = {}
) {
  const provider = getProviderCode(settings)
  if (provider === 'gemini') {
    const response = await requestProviderJson(
      settings,
      requestBody,
      requestUrl,
      options
    )
    if (response.contentText && typeof handlers.onChunk === 'function') {
      handlers.onChunk({
        contentDelta: response.contentText,
        reasoningDelta: ''
      })
    }
    return response
  }

  const response = await requestDeepSeekStream(
    requestUrl,
    requestBody,
    settings,
    handlers,
    options
  )
  const rawResponse = response.data || {}
  return {
    statusCode: response.statusCode,
    provider,
    rawResponse,
    contentText: normalizeTrimmedString(
      rawResponse?.choices?.[0]?.message?.content,
      200000
    ),
    reasoningText: normalizeTrimmedString(
      rawResponse?.choices?.[0]?.message?.reasoning_content,
      200000
    ),
    finishReason: normalizeTrimmedString(
      rawResponse?.choices?.[0]?.finish_reason,
      120
    ),
    model: rawResponse.model || settings.deepSeekModel || settings.model,
    requestId: rawResponse.id || '',
    usage: rawResponse.usage || {},
    parseError: false
  }
}

module.exports = {
  buildJsonRequestBody,
  getProviderCode,
  getProviderErrorField,
  getProviderLabel,
  requestProviderJson,
  requestProviderStream
}
