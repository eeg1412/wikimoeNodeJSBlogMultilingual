const sourcePostProperNounRelationService = require('./services/sourcePostProperNounRelationService')
const { buildErrorPayload, prepareSseResponse } = require('./utils/sseStream')

/**
 * 以 SSE 流的形式执行源文章名词导入，并实时推送进度
 * @param {Object} req - 请求对象
 * @param {Object} res - 响应对象
 * @returns {Promise<void>}
 */
module.exports = async function streamSourcePostProperNounImport(req, res) {
  const stream = prepareSseResponse(req, res)

  try {
    stream.send('status', { message: '正在校验导入数据' })
    const data =
      await sourcePostProperNounRelationService.importSourcePostTerms(
        req.body || {},
        {
          onProgress(progress) {
            stream.send('progress', progress)
          },
          cancellation: stream.cancellation
        }
      )
    stream.send('result', data)
    stream.send('done', {
      totalCount: data.totalCount,
      processedCount: data.processedCount,
      cancelled: data.cancelled
    })
  } catch (error) {
    stream.send('error', buildErrorPayload(error, '导入失败'))
  } finally {
    stream.end()
  }
}
