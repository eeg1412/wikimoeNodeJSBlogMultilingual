const mediaService = require('../services/mediaService')
const handleApiError = require('../handleApiError')

module.exports = async function replaceLocal(req, res) {
  const files = req.files || {}
  const fileList = Array.isArray(files) ? files : []
  const getFileByFieldName = fieldName => {
    const fileItem = fileList.find(item => {
      return item.fieldname === fieldName
    })
    if (fileItem) {
      return fileItem
    }
    return files[fieldName]?.[0]
  }

  let file =
    req.file || getFileByFieldName('file') || getFileByFieldName('video')
  let coverFile = getFileByFieldName('cover')
  try {
    const data = await mediaService.replaceLocalAttachment(
      req.body,
      file,
      coverFile,
      req.headers
    )
    res.send({ data })
  } catch (error) {
    handleApiError(res, error, 'media replace local fail')
  } finally {
    if (file) {
      file.buffer = null
      file = null
    }
    if (coverFile) {
      coverFile.buffer = null
      coverFile = null
    }
  }
}
