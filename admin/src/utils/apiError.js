function tryParseJson(data) {
  if (typeof data !== 'string') {
    return data
  }

  try {
    return JSON.parse(data)
  } catch {
    return data
  }
}

function pushMessage(messageList, message) {
  if (!message) {
    return
  }

  const text = String(message).trim()
  if (!text) {
    return
  }

  if (!messageList.includes(text)) {
    messageList.push(text)
  }
}

function appendItemMessage(messageList, item) {
  if (!item) {
    return
  }

  if (typeof item === 'string') {
    pushMessage(messageList, item)
    return
  }

  if (typeof item !== 'object') {
    pushMessage(messageList, item)
    return
  }

  if (item.message) {
    pushMessage(messageList, item.message)
    return
  }

  if (item.msg) {
    pushMessage(messageList, item.msg)
    return
  }

  if (item.error) {
    pushMessage(messageList, item.error)
    return
  }

  if (item.code) {
    pushMessage(messageList, `请求失败（${item.code}）`)
  }
}

function appendArrayMessages(messageList, list) {
  if (!Array.isArray(list)) {
    return
  }

  list.forEach(item => {
    appendItemMessage(messageList, item)
  })
}

export function extractApiErrorMessages(error) {
  const response = error?.response
  const data = tryParseJson(response?.data)
  const messageList = []

  if (data && typeof data === 'object') {
    appendArrayMessages(messageList, data.errorList)
    appendArrayMessages(messageList, data.errors)
    appendItemMessage(messageList, data.error)
    pushMessage(messageList, data.message)
    pushMessage(messageList, data.msg)
    pushMessage(messageList, data.statusMessage)
  } else if (typeof data === 'string') {
    pushMessage(messageList, data)
  }

  if (messageList.length === 0) {
    const fallbackMessage = error?.message
    if (fallbackMessage && fallbackMessage !== 'Network Error') {
      pushMessage(messageList, fallbackMessage)
    }
  }

  if (messageList.length === 0) {
    if (!response) {
      messageList.push('网络请求失败，请检查服务是否可用')
    } else if (response.status) {
      messageList.push(`请求失败（HTTP ${response.status}）`)
    } else {
      messageList.push('请求失败')
    }
  }

  return messageList
}

async function readResponseErrorData(response) {
  if (!response || typeof response.text !== 'function') {
    return null
  }

  try {
    const text = await response.text()
    if (!text) {
      return null
    }

    return tryParseJson(text)
  } catch {
    return null
  }
}

export async function createApiErrorFromResponse(response, fallbackMessage) {
  const data = await readResponseErrorData(response)
  const responseError = {
    response: {
      status: response.status,
      statusText: response.statusText,
      data
    }
  }

  const messageList = extractApiErrorMessages(responseError)
  if (data === null && fallbackMessage && response.status) {
    messageList.length = 0
    messageList.push(`${fallbackMessage}（HTTP ${response.status}）`)
  }

  if (messageList.length === 0 && fallbackMessage) {
    messageList.push(fallbackMessage)
  }

  const error = new Error(messageList[0] || fallbackMessage || '请求失败')
  error.name = 'ApiResponseError'
  error.response = responseError.response
  error.messageList = messageList

  return error
}