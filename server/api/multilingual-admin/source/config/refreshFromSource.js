const {
  refreshSourceConfigRuntimeData,
  validateSourceAdminAuthorization
} = require('../../services/sourceConfigService')
const handleApiError = require('../../handleApiError')

/**
 * 处理源站保存配置后的自动刷新回调。
 * 该接口接收源站后台 JWT，并在回源站校验通过后刷新多语言站的源站配置缓存。
 * @param {import('express').Request} req - Express 请求对象
 * @param {import('express').Response} res - Express 响应对象
 * @returns {Promise<void>} 接口处理完成后无返回值
 */
module.exports = async function refreshSourceConfigFromSource(req, res) {
  try {
    await validateSourceAdminAuthorization(req.headers.authorization)
    const data = await refreshSourceConfigRuntimeData()
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'refresh source config from source fail')
  }
}
