const sourceTaxonomyService = require('../../services/sourceTaxonomyService')
const handleApiError = require('../../handleApiError')

module.exports = async function getSourceTagList(req, res) {
  try {
    const data = await sourceTaxonomyService.getSourceTagList(req.query)
    // 标签选择器读取响应体中的 list/total，保持与源站标签接口一致的结构
    res.send(data)
  } catch (error) {
    handleApiError(res, error, 'source tag list get fail')
  }
}
