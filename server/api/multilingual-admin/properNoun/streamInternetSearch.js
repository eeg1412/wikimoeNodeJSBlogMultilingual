const properNounInternetSearchService = require('../services/properNounInternetSearchService')
const { buildErrorPayload, prepareSseResponse } = require('../utils/sseStream')

module.exports = async function streamInternetSearch(req, res) {
  const stream = prepareSseResponse(req, res)

  try {
    stream.send('status', { message: '正在准备联网检索' })
    const data =
      await properNounInternetSearchService.searchInternetTranslations(
        req.body || {},
        {
          onStatus(status) {
            stream.send('status', status)
          },
          cancellation: stream.cancellation
        }
      )
    stream.send('result', data)
    stream.send('done', {
      provider: data.provider || '',
      model: data.model || ''
    })
  } catch (error) {
    stream.send('error', buildErrorPayload(error, '联网检索失败'))
  } finally {
    stream.end()
  }
}
