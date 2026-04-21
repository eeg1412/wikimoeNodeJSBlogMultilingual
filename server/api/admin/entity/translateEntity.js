const { entityTranslateFieldsSchema } = require('@wikimoe-ml/common/validation')
const {
  translateEntityFields
} = require('../../../services/sharedEntityCrudService')
const { badRequest } = require('../../../utils/errors')

/**
 * POST /api/admin/entity/:type/translate { _id, fields?: string[] }
 * 调用 AI 翻译指定字段并写回。
 */
module.exports = async function translateEntityApi(req, res) {
  const type = req.params.type
  const { value, error } = entityTranslateFieldsSchema.validate(
    req.body || {},
    { abortEarly: false, stripUnknown: true }
  )
  if (error) throw badRequest('参数校验失败', error.details)
  const adminId = req.admin && req.admin._id ? String(req.admin._id) : null
  const data = await translateEntityFields(
    type,
    value._id,
    value.fields,
    adminId
  )
  res.json({ data })
}
