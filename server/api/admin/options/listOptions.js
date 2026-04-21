const { getAllOptions } = require('../../../utils/options')

/**
 * GET /api/admin/options
 * 返回完整 options（含敏感/高级配置），用于后台配置页。
 */
module.exports = async function listOptionsApi(req, res) {
  const data = await getAllOptions()
  res.json({ data })
}
