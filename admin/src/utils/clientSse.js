export function parseClientSseBlock(block) {
  const eventData = {
    eventName: 'message',
    data: {}
  }
  const dataLines = []
  block.split(/\r?\n/).forEach(line => {
    if (line.startsWith('event:')) {
      eventData.eventName = line.slice(6).trim()
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  })
  if (dataLines.length === 0) {
    return null
  }
  try {
    eventData.data = JSON.parse(dataLines.join('\n'))
  } catch (error) {
    eventData.data = {}
  }
  return eventData
}

export function findClientSseBoundary(buffer) {
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

export async function readClientSseStream(response, handleEvent) {
  if (!response.body) {
    throw new Error('当前浏览器无法读取实时反馈')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  function consumeBuffer() {
    let boundary = findClientSseBoundary(buffer)
    while (boundary.index >= 0) {
      const block = buffer.slice(0, boundary.index)
      buffer = buffer.slice(boundary.index + boundary.length)
      handleEvent(parseClientSseBlock(block))
      boundary = findClientSseBoundary(buffer)
    }
  }

  let done = false
  while (!done) {
    const result = await reader.read()
    done = result.done
    if (result.value) {
      buffer += decoder.decode(result.value, { stream: !done })
      consumeBuffer()
    }
  }

  if (buffer.trim()) {
    handleEvent(parseClientSseBlock(buffer))
  }
}

export function isAbortError(error) {
  if (!error) {
    return false
  }
  if (error.name === 'AbortError') {
    return true
  }
  if (error.code === 'ABORT_ERR') {
    return true
  }
  return false
}
