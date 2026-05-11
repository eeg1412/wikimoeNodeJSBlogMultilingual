const deepSeekTranslationService = require('../../services/deepSeekTranslationService')

function sendSseEvent(res, eventName, data) {
  res.write(`event: ${eventName}\n`)
  res.write(`data: ${JSON.stringify(data || {})}\n\n`)
}

function getErrorMessage(error) {
  if (error && error.message) {
    return error.message
  }
  return 'AI 翻译失败'
}

function buildErrorPayload(error) {
  const payload = {
    message: getErrorMessage(error),
    code: error?.code || 'AI_TRANSLATION_FAILED'
  }
  if (error?.extra && typeof error.extra === 'object') {
    if (typeof error.extra.retryable === 'boolean') {
      payload.retryable = error.extra.retryable
    }
    if (error.extra.manualRetryRequired === true) {
      payload.manualRetryRequired = true
    }
    if (error.extra.aiStepKey) {
      payload.aiStepKey = error.extra.aiStepKey
    }
    if (error.extra.aiStepLabel) {
      payload.aiStepLabel = error.extra.aiStepLabel
    }
    if (error.extra.aiStepAttempts) {
      payload.aiStepAttempts = error.extra.aiStepAttempts
    }
    if (error.extra.aiStepMaxAttempts) {
      payload.aiStepMaxAttempts = error.extra.aiStepMaxAttempts
    }
  }
  return payload
}

function createCancellationContext() {
  let cancelled = false
  let reason = ''
  const listeners = new Set()

  return {
    get isCancelled() {
      return cancelled
    },
    get reason() {
      return reason
    },
    cancel(nextReason) {
      if (cancelled) {
        return
      }
      cancelled = true
      reason = String(nextReason || '').trim() || '客户端已断开连接'
      listeners.forEach(listener => {
        listener(reason)
      })
      listeners.clear()
    },
    onCancel(listener) {
      if (typeof listener !== 'function') {
        return () => {}
      }
      if (cancelled) {
        listener(reason)
        return () => {}
      }
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
  }
}

module.exports = async function streamTranslatePost(req, res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders()
  }

  let closed = false
  const cancellation = createCancellationContext()
  req.on('aborted', () => {
    closed = true
    cancellation.cancel('客户端中止了请求')
  })
  res.on('close', () => {
    closed = true
    cancellation.cancel('连接已关闭')
  })

  function send(eventName, data) {
    if (closed) {
      return
    }
    sendSseEvent(res, eventName, data)
  }

  try {
    const data = await deepSeekTranslationService.translatePostEntriesStream(
      req.body,
      {
        onStatus(status) {
          send('status', status)
        },
        onChunk(chunk) {
          send('chunk', chunk)
        },
        onChunkRollback(rollback) {
          send('chunkRollback', rollback)
        },
        onResult(result) {
          send('result', result)
        },
        cancellation
      }
    )
    send('done', {
      requestId: data.requestId || null,
      model: data.model || ''
    })
  } catch (error) {
    send('error', buildErrorPayload(error))
  } finally {
    if (!closed) {
      res.end()
    }
  }
}
