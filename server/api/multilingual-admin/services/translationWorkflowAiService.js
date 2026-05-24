const deepSeekTranslationService = require('./deepSeekTranslationService')

async function translatePostEntries(body = {}) {
  return deepSeekTranslationService.translatePostEntries(body)
}

async function translatePostEntriesStream(body = {}, handlers = {}) {
  return deepSeekTranslationService.translatePostEntriesStream(body, handlers)
}

async function translateContentEntriesStream(body = {}, handlers = {}) {
  return deepSeekTranslationService.translateContentEntriesStream(
    body,
    handlers
  )
}

async function organizeProperNounTerms(body = {}, handlers = {}) {
  return deepSeekTranslationService.organizeProperNounTerms(body, handlers)
}

module.exports = {
  organizeProperNounTerms,
  translateContentEntriesStream,
  translatePostEntries,
  translatePostEntriesStream
}
