const { Posts, ImportJobs } = require('../../../mongodb/models')
const {
  SUPPORTED_LANGUAGE_CODES,
  TRANSLATION_STATUS_VALUES,
  POST_STATUS_DRAFT,
  POST_STATUS_PUBLISHED,
  POST_STATUS_TRASH
} = require('@wikimoe-ml/common/constants')
const { getAllOptions } = require('../../../utils/options')

function createLanguageSummary(languageCode) {
  return {
    languageCode,
    total: 0,
    published: 0,
    draft: 0,
    trash: 0,
    approved: 0,
    not_required: 0,
    ai_draft: 0,
    manual_draft: 0,
    outdated: 0,
    pending: 0,
    stub: 0
  }
}

module.exports = async function getDashboardSummaryApi(req, res) {
  const [
    statusRows,
    translationRows,
    typeRows,
    groupRows,
    recentImports,
    recentPosts,
    options
  ] = await Promise.all([
    Posts.aggregate([
      {
        $group: {
          _id: {
            languageCode: '$languageCode',
            status: '$status'
          },
          count: { $sum: 1 }
        }
      }
    ]),
    Posts.aggregate([
      {
        $group: {
          _id: {
            languageCode: '$languageCode',
            translationStatus: '$translationStatus'
          },
          count: { $sum: 1 }
        }
      }
    ]),
    Posts.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]),
    Posts.aggregate([
      { $group: { _id: '$groupSourceId' } },
      { $count: 'count' }
    ]),
    ImportJobs.find(
      {},
      {
        sourceIdentifier: 1,
        sourceResolvedId: 1,
        languageCode: 1,
        status: 1,
        stage: 1,
        resultPostId: 1,
        warnings: 1,
        errorList: 1,
        updatedAt: 1,
        createdAt: 1
      }
    )
      .sort({ createdAt: -1 })
      .limit(8)
      .lean(),
    Posts.find(
      {},
      {
        title: 1,
        alias: 1,
        sourceId: 1,
        groupSourceId: 1,
        languageCode: 1,
        status: 1,
        translationStatus: 1,
        updatedAt: 1,
        type: 1
      }
    )
      .sort({ updatedAt: -1 })
      .limit(8)
      .lean(),
    getAllOptions()
  ])

  const byLanguage = {}
  SUPPORTED_LANGUAGE_CODES.forEach(code => {
    byLanguage[code] = createLanguageSummary(code)
  })

  let totalPosts = 0
  let publishedPosts = 0
  let draftPosts = 0
  let trashPosts = 0

  statusRows.forEach(row => {
    const languageCode = row?._id?.languageCode
    const status = row?._id?.status
    const count = row?.count || 0
    if (!byLanguage[languageCode]) {
      byLanguage[languageCode] = createLanguageSummary(languageCode)
    }
    byLanguage[languageCode].total += count
    totalPosts += count
    if (status === POST_STATUS_PUBLISHED) {
      byLanguage[languageCode].published += count
      publishedPosts += count
    } else if (status === POST_STATUS_TRASH) {
      byLanguage[languageCode].trash += count
      trashPosts += count
    } else if (status === POST_STATUS_DRAFT) {
      byLanguage[languageCode].draft += count
      draftPosts += count
    }
  })

  const translationStatusCounts = {}
  TRANSLATION_STATUS_VALUES.forEach(status => {
    translationStatusCounts[status] = 0
  })

  translationRows.forEach(row => {
    const languageCode = row?._id?.languageCode
    const translationStatus = row?._id?.translationStatus
    const count = row?.count || 0
    if (!byLanguage[languageCode]) {
      byLanguage[languageCode] = createLanguageSummary(languageCode)
    }
    if (
      translationStatus &&
      Object.prototype.hasOwnProperty.call(
        byLanguage[languageCode],
        translationStatus
      )
    ) {
      byLanguage[languageCode][translationStatus] += count
    }
    if (
      translationStatus &&
      Object.prototype.hasOwnProperty.call(
        translationStatusCounts,
        translationStatus
      )
    ) {
      translationStatusCounts[translationStatus] += count
    }
  })

  let blogCount = 0
  let tweetCount = 0
  typeRows.forEach(row => {
    if (row._id === 1) blogCount = row.count || 0
    if (row._id === 2) tweetCount = row.count || 0
  })

  const summary = {
    totals: {
      posts: totalPosts,
      groups: groupRows[0]?.count || 0,
      published: publishedPosts,
      draft: draftPosts,
      trash: trashPosts,
      blog: blogCount,
      tweet: tweetCount,
      needsAttention:
        (translationStatusCounts.outdated || 0) +
        (translationStatusCounts.pending || 0) +
        (translationStatusCounts.stub || 0)
    },
    byLanguage: Object.values(byLanguage),
    translationStatus: TRANSLATION_STATUS_VALUES.map(status => ({
      key: status,
      count: translationStatusCounts[status] || 0
    }))
  }

  res.json({
    data: {
      summary,
      recentImports: recentImports.map(item => ({
        _id: item._id,
        sourceIdentifier: item.sourceIdentifier,
        sourceResolvedId: item.sourceResolvedId,
        languageCode: item.languageCode,
        status: item.status,
        stage: item.stage,
        resultPostId: item.resultPostId,
        warningCount: Array.isArray(item.warnings) ? item.warnings.length : 0,
        errorCount: Array.isArray(item.errorList) ? item.errorList.length : 0,
        updatedAt: item.updatedAt,
        createdAt: item.createdAt
      })),
      recentPosts,
      optionsSnapshot: {
        siteTitle: options.siteTitle || '',
        siteUrl: options.siteUrl || '',
        siteDefaultLanguageCode: options.siteDefaultLanguageCode || 'en',
        googleAdEnabled: Boolean(options.googleAdEnabled)
      }
    }
  })
}
