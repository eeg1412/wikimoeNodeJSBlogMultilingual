const sourcePostProperNounRelationService = require('./services/sourcePostProperNounRelationService')
const translationJobService = require('./services/translationJobService')
const handleApiError = require('./handleApiError')
const { TRANSLATION_JOB_TYPES } = require('../../utils/translationJobConstants')

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
  return await sourcePostProperNounRelationService.getSourcePostTermList(
    req.query || {}
  )
}

async function createOrBindTerm(req) {
  return await sourcePostProperNounRelationService.createOrBindSourcePostTerm(
    req.body || {}
  )
}

async function batchBindTerms(req) {
  return await sourcePostProperNounRelationService.batchBindExistingTermsToSourcePost(
    req.body || {}
  )
}

async function unbindTerm(req) {
  return await sourcePostProperNounRelationService.unbindSourcePostTerm(
    req.query || {}
  )
}

async function exportTerms(req) {
  return await sourcePostProperNounRelationService.exportSourcePostTerms(
    req.body || {}
  )
}

async function importTerms(req) {
  return await sourcePostProperNounRelationService.importSourcePostTerms(
    req.body || {}
  )
}

async function previewImportTerms(req) {
  return await sourcePostProperNounRelationService.previewImportSourcePostTerms(
    req.body || {}
  )
}

function getOrganizeJobRecursion(body) {
  if (body.recursion && body.recursion.maxDepth !== undefined) {
    return {
      maxDepth: body.recursion.maxDepth
    }
  }
  if (body.maxDepth !== undefined) {
    return {
      maxDepth: body.maxDepth
    }
  }
  return {
    maxDepth: 3
  }
}

async function createOrganizeJob(req) {
  const body = req.body || {}
  return await translationJobService.createTranslationJob(
    {
      jobType: TRANSLATION_JOB_TYPES.SOURCE_POST_PROPER_NOUN_ORGANIZE,
      source: {
        postId: body.sourceId || body.postId,
        languageCode: body.sourceLanguageCode,
        title: body.title || ''
      },
      target: {
        languageCodes: body.targetLanguageCodes || [],
        title: body.title || ''
      },
      request: {
        targetLanguageCodes: body.targetLanguageCodes || [],
        recursion: getOrganizeJobRecursion(body),
        options: {
          searchOfficialTermTranslations:
            body.searchOfficialTermTranslations === true,
          syncRelatedPosts: body.syncRelatedPosts === true
        }
      }
    },
    {
      admin: req.admin
    }
  )
}

module.exports = {
  batchBindTerms: controller(
    batchBindTerms,
    'source post proper noun term batch bind fail'
  ),
  createOrBindTerm: controller(
    createOrBindTerm,
    'source post proper noun term bind fail'
  ),
  createOrganizeJob: controller(
    createOrganizeJob,
    'source post proper noun organize job create fail'
  ),
  exportTerms: controller(
    exportTerms,
    'source post proper noun term export fail'
  ),
  getTermList: controller(
    getTermList,
    'source post proper noun term list get fail'
  ),
  importTerms: controller(
    importTerms,
    'source post proper noun term import fail'
  ),
  previewImportTerms: controller(
    previewImportTerms,
    'source post proper noun term import preview fail'
  ),
  unbindTerm: controller(unbindTerm, 'source post proper noun term unbind fail')
}
