const { normalizeLanguageCode } = require('../../../utils/language')
const properNounTranslationService = require('./properNounTranslationService')
const sourcePostProperNounRelationService = require('./sourcePostProperNounRelationService')

function buildOfficialTermGlossaryMarkdownMap({
  extractedTerms,
  targetLanguageCodes,
  coverage,
  includeMissingTerms = false
}) {
  const glossaryMarkdownMap = {}
  let missingTerms = []
  if (includeMissingTerms === true) {
    missingTerms = coverage.missingTerms || []
  }
  targetLanguageCodes.forEach(languageCode => {
    const markdown = properNounTranslationService.buildGlossaryMarkdown({
      sourceTexts: extractedTerms,
      targetLanguageCodes: [languageCode],
      translations: coverage.translations,
      missingTerms
    })
    if (markdown) {
      glossaryMarkdownMap[languageCode] = markdown
    }
  })
  return glossaryMarkdownMap
}

function getCurrentOfficialTermGlossaryMarkdown({
  input,
  glossaryMarkdownMap
}) {
  const currentLanguageCode = normalizeLanguageCode(input.targetLanguageCode)
  if (currentLanguageCode && glossaryMarkdownMap[currentLanguageCode]) {
    return glossaryMarkdownMap[currentLanguageCode]
  }
  return ''
}

async function resolveLinkedOfficialTermGlossaryData({
  sourcePostId,
  sourceLanguageCode,
  targetLanguageCodes,
  handlers
}) {
  let linkedGlossaryCoverage = {
    sourceTextItems: [],
    candidateTerms: [],
    translations: [],
    matchedTermIds: [],
    matchedTermLinks: [],
    coverage: {
      sourceTextItems: [],
      languageCodes: targetLanguageCodes,
      translations: [],
      existingTerms: [],
      missingTerms: [],
      candidateTerms: []
    }
  }

  if (sourcePostId) {
    linkedGlossaryCoverage =
      await sourcePostProperNounRelationService.getSourcePostLinkedTermGlossaryCoverage(
        {
          sourcePostId,
          sourceLanguageCode,
          targetLanguageCodes
        }
      )
  }

  const extractedTerms = properNounTranslationService.normalizeExtractedTermList(
    linkedGlossaryCoverage.sourceTextItems
  )
  const keywordArray = extractedTerms.map(term => term.sourceText)
  const coverage = linkedGlossaryCoverage.coverage || {
    translations: [],
    existingTerms: [],
    missingTerms: []
  }
  const candidateTerms = linkedGlossaryCoverage.candidateTerms || []
  const matchedTermIds = linkedGlossaryCoverage.matchedTermIds || []
  const matchedTermLinks = linkedGlossaryCoverage.matchedTermLinks || []
  const translations = linkedGlossaryCoverage.translations || []
  const glossaryMarkdownMap = buildOfficialTermGlossaryMarkdownMap({
    extractedTerms,
    targetLanguageCodes,
    coverage,
    includeMissingTerms: true
  })

  if (handlers.onStatus) {
    if (!sourcePostId) {
      handlers.onStatus({
        message: '当前翻译没有源文章名词词库范围，跳过自动整理词库'
      })
    } else if (keywordArray.length === 0) {
      handlers.onStatus({
        message: '源文章没有已整理的专有名词，跳过自动整理词库'
      })
    } else {
      handlers.onStatus({
        message: `已复用源文章整理的 ${keywordArray.length} 个专有名词用于本次翻译`
      })
    }
  }

  return {
    aiJsonLogs: [],
    extractedTerms,
    keywordArray,
    matchedTermIds,
    matchedTermLinks,
    matchedCandidateTerms: candidateTerms,
    candidateCoverage: {
      sourceTextItems: extractedTerms,
      languageCodes: targetLanguageCodes,
      candidateTerms,
      translations,
      articleLinkedCandidateCount: candidateTerms.length
    },
    coverage,
    savedTranslations: [],
    officialTermContextSummary: '',
    officialTermGlossaryMarkdownMap: glossaryMarkdownMap
  }
}

function buildLinkedOfficialTermStats(glossaryData, missingRequestCount) {
  const coverage = glossaryData.coverage || {
    existingTerms: [],
    missingTerms: []
  }
  const candidateCoverage = glossaryData.candidateCoverage || {
    candidateTerms: []
  }
  return {
    keywordCount: glossaryData.keywordArray.length,
    candidateCount: candidateCoverage.candidateTerms.length || 0,
    articleLinkedCandidateCount:
      candidateCoverage.candidateTerms.length || 0,
    matchedTermCount: glossaryData.matchedTermIds.length || 0,
    existingCount: coverage.existingTerms.length || 0,
    missingCount: coverage.missingTerms.length || 0,
    missingRequestCount,
    aiKnowledgeBaseTermCount: 0,
    aiKnowledgeBaseTranslationCount: 0,
    internetSearchTermCount: 0,
    internetSearchTranslationCount: 0,
    internetSearchRequestedTermCount: 0,
    internetSearchTargetLanguageCodes: [],
    contextSummaryLength: 0,
    glossaryLanguageCodes: Object.keys(
      glossaryData.officialTermGlossaryMarkdownMap || {}
    )
  }
}

module.exports = {
  buildLinkedOfficialTermStats,
  buildOfficialTermGlossaryMarkdownMap,
  getCurrentOfficialTermGlossaryMarkdown,
  resolveLinkedOfficialTermGlossaryData
}
