const properNounTranslationService = require('./services/properNounTranslationService')
const properNounInternetSearchService = require('./services/properNounInternetSearchService')
const handleApiError = require('./handleApiError')

function controller(handler, logMessage) {
  return async function (req, res) {
    try {
      const data = await handler(req)
      res.send({ data })
    } catch (error) {
      handleApiError(res, error, logMessage)
    }
  }
}

async function getTermList(req) {
  return await properNounTranslationService.getTermList(req.query || {})
}

async function getTermDetail(req) {
  return await properNounTranslationService.getTermDetail(req.query || {})
}

async function createTerm(req) {
  return await properNounTranslationService.createTerm(req.body || {})
}

async function updateTerm(req) {
  return await properNounTranslationService.updateTerm(req.body || {})
}

async function updateTermStar(req) {
  return await properNounTranslationService.updateTermStar(req.body || {})
}

async function deleteTerm(req) {
  return await properNounTranslationService.deleteTerm(req.query || {})
}

async function batchDeleteTerms(req) {
  return await properNounTranslationService.batchDeleteTerms(req.body || {})
}

async function getTranslationList(req) {
  return await properNounTranslationService.getTranslationList(req.query || {})
}

async function createTranslation(req) {
  return await properNounTranslationService.createTranslation(req.body || {})
}

async function updateTranslation(req) {
  return await properNounTranslationService.updateTranslation(req.body || {})
}

async function deleteTranslation(req) {
  return await properNounTranslationService.deleteTranslation(req.query || {})
}

async function searchInternetTranslations(req) {
  return await properNounInternetSearchService.searchInternetTranslations(
    req.body || {}
  )
}

async function applyInternetTranslations(req) {
  return await properNounInternetSearchService.applyInternetTranslations(
    req.body || {}
  )
}

module.exports = {
  getTermList: controller(getTermList, 'proper noun term list get fail'),
  getTermDetail: controller(getTermDetail, 'proper noun term detail get fail'),
  createTerm: controller(createTerm, 'proper noun term create fail'),
  updateTerm: controller(updateTerm, 'proper noun term update fail'),
  updateTermStar: controller(updateTermStar, 'proper noun term star fail'),
  deleteTerm: controller(deleteTerm, 'proper noun term delete fail'),
  batchDeleteTerms: controller(
    batchDeleteTerms,
    'proper noun term batch delete fail'
  ),
  getTranslationList: controller(
    getTranslationList,
    'proper noun translation list get fail'
  ),
  createTranslation: controller(
    createTranslation,
    'proper noun translation create fail'
  ),
  updateTranslation: controller(
    updateTranslation,
    'proper noun translation update fail'
  ),
  deleteTranslation: controller(
    deleteTranslation,
    'proper noun translation delete fail'
  ),
  searchInternetTranslations: controller(
    searchInternetTranslations,
    'proper noun internet search fail'
  ),
  applyInternetTranslations: controller(
    applyInternetTranslations,
    'proper noun internet search apply fail'
  )
}
