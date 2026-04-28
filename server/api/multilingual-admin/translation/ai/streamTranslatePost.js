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

module.exports = async function streamTranslatePost(req, res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders()
  }

  let closed = false
  req.on('aborted', () => {
    closed = true
  })
  res.on('close', () => {
    closed = true
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
        onResult(result) {
          send('result', result)
        }
      }
    )
    send('done', {
      requestId: data.requestId || null,
      model: data.model || ''
    })
  } catch (error) {
    send('error', {
      message: getErrorMessage(error),
      code: error?.code || 'AI_TRANSLATION_FAILED'
    })
  } finally {
    if (!closed) {
      res.end()
    }
  }
}
