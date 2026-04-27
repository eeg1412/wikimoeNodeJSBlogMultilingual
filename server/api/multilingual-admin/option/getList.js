const { normalizeLanguageCode } = require('../../../utils/language')
const { handleApiError } = require('../../../utils/multilingualAdminResponse')

const DEFAULT_LANGUAGE_CODE = 'zh-CN'

function getOptionModel() {
  const repository = global.$mongodDB.multilingual.repositories.options
  if (!repository || !repository.model) {
    throw new Error('multilingual options repository not found')
  }

  return repository.model
}

function normalizeNameList(nameList) {
  if (Array.isArray(nameList)) {
    return nameList.map(item => String(item).trim()).filter(Boolean)
  }

  if (typeof nameList === 'string' && nameList.trim()) {
    return [nameList.trim()]
  }

  return []
}

module.exports = async function (req, res) {
  try {
    const languageCode =
      normalizeLanguageCode(req.query.languageCode) || DEFAULT_LANGUAGE_CODE
    const nameList = normalizeNameList(req.query.nameList)
    const params = {
      scope: 'multilingual',
      languageCode
    }
    if (nameList.length > 0) {
      params.name = { $in: nameList }
    }

    const OptionModel = getOptionModel()
    const data = await OptionModel.find(params)
      .select('name value languageCode scope')
      .sort({ name: 1 })
      .lean()
    res.send({ data })
  } catch (error) {
    handleApiError(res, error)
  }
}
