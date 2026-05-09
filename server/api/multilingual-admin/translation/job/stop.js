const translationJobService = require('../../services/translationJobService')
const translationJobWorker = require('../../services/translationJobWorker')
const handleApiError = require('../../handleApiError')
const {
  ApiError,
  ERROR_CODES
} = require('../../../../utils/multilingualAdminResponse')

module.exports = async function stopTranslationJob(req, res) {
  try {
    const id = String(req.body?.id || '').trim()
    if (!translationJobWorker.hasActiveTranslationJob(id)) {
      throw new ApiError(
        ERROR_CODES.TRANSLATION_JOB_ACTION_FORBIDDEN,
        '当前任务未在本进程 worker 中执行，无法断开 AI 连接',
        'id',
        400
      )
    }

    const stopRequest =
      await translationJobService.requestStopRunningTranslationJob(req.body, {
        admin: req.admin
      })
    const cancelled = translationJobWorker.cancelRunningTranslationJob(
      stopRequest.id,
      stopRequest.reason
    )
    if (!cancelled) {
      throw new ApiError(
        ERROR_CODES.TRANSLATION_JOB_ACTION_FORBIDDEN,
        '停止请求已记录，但当前 worker 未找到可断开的 AI 连接',
        'id',
        409
      )
    }

    res.send({
      data: {
        stopped: true,
        id: stopRequest.id,
        workerId: stopRequest.workerId,
        attemptNo: stopRequest.attemptNo
      }
    })
  } catch (error) {
    handleApiError(res, error, 'translation job stop fail')
  }
}
