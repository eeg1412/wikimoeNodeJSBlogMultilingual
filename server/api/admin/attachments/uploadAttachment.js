const { badRequest } = require('../../../utils/errors')
const {
  uploadLocalizedAttachment
} = require('../../../services/attachmentService')
const { SUPPORTED_LANGUAGE_CODES } = require('@wikimoe-ml/common/constants')

// 该接口由路由层应用 multer.single('file') 中间件
module.exports = async function uploadAttachmentApi(req, res) {
  if (!req.file) {
    throw badRequest('缺少 file 字段')
  }
  const languageCode = (req.body && req.body.languageCode) || ''
  if (!SUPPORTED_LANGUAGE_CODES.includes(languageCode)) {
    throw badRequest('languageCode 无效')
  }
  const widthRaw = req.body && req.body.width
  const heightRaw = req.body && req.body.height
  const width = widthRaw ? Number(widthRaw) : null
  const height = heightRaw ? Number(heightRaw) : null

  const result = await uploadLocalizedAttachment({
    buffer: req.file.buffer,
    originalName: req.file.originalname,
    mimetype: req.file.mimetype,
    languageCode,
    width: Number.isFinite(width) ? width : null,
    height: Number.isFinite(height) ? height : null,
    name: (req.body && req.body.name) || '',
    description: (req.body && req.body.description) || ''
  })
  res.json({ data: result })
}
