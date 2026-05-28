const textTranslationWorkflowService = require('./textTranslationWorkflowService')

async function translatePostEntries(body = {}) {
  return textTranslationWorkflowService.translatePostEntries(body)
}

async function translatePostEntriesStream(body = {}, handlers = {}) {
  return textTranslationWorkflowService.translatePostEntriesStream(
    body,
    handlers
  )
}

async function translateContentEntriesStream(body = {}, handlers = {}) {
  return textTranslationWorkflowService.translateContentEntriesStream(
    body,
    handlers
  )
}

async function organizeProperNounTerms(body = {}, handlers = {}) {
  return textTranslationWorkflowService.organizeProperNounTerms(body, handlers)
}

module.exports = {
  organizeProperNounTerms,
  translateContentEntriesStream,
  translatePostEntries,
  translatePostEntriesStream
}
