const { SUPPORTED_LANGUAGE_CODES } = require('../../../utils/language')
const { handleApiError } = require('../../../utils/multilingualAdminResponse')
const importPostSourceService = require('../services/importPostSourceService')

const SOURCE_RECORD_KIND = 'source'
const TRANSLATION_RECORD_KIND = 'translation'

function getModel(collectionName) {
  const repository = global.$mongodDB.multilingual.repositories[collectionName]
  if (!repository || !repository.model) {
    throw new Error(`multilingual repository not found: ${collectionName}`)
  }
  return repository.model
}

async function getLanguageStats(PostModel) {
  const rows = await PostModel.aggregate([
    { $match: { recordKind: TRANSLATION_RECORD_KIND } },
    { $group: { _id: '$languageCode', total: { $sum: 1 } } }
  ])
  const stats = {}
  for (const languageCode of SUPPORTED_LANGUAGE_CODES) {
    stats[languageCode] = 0
  }
  for (const row of rows) {
    if (row._id) {
      stats[row._id] = row.total
    }
  }
  return stats
}

async function getSourceGroupTotal(PostModel) {
  const rows = await PostModel.aggregate([
    {
      $match: {
        recordKind: SOURCE_RECORD_KIND,
        translationGroupId: { $ne: null }
      }
    },
    { $group: { _id: '$translationGroupId' } },
    { $count: 'total' }
  ])

  return rows[0]?.total || 0
}

async function attachRecentImportTranslationSummary(recentImports) {
  if (recentImports.length === 0) {
    return recentImports
  }

  // 复用源文章快照列表（多语言文字）的同一套摘要计算逻辑，
  // 保证工作台「语言版本」列展示的各语言状态与快照列表完全一致。
  const normalizedList =
    await importPostSourceService.normalizeSourcePostSnapshotIdentityList(
      recentImports
    )
  const summaryMap =
    await importPostSourceService.buildTranslationSummaryMap(normalizedList)

  return normalizedList.map(item => ({
    ...item,
    translationSummary:
      summaryMap[importPostSourceService.getSourcePostGroupKey(item)] ||
      importPostSourceService.buildEmptyTranslationSummary()
  }))
}

module.exports = async function (req, res) {
  try {
    const PostModel = getModel('posts')
    const AttachmentModel = getModel('attachments')
    const [
      sourceSnapshotTotal,
      sourceGroupTotal,
      pendingReviewTotal,
      publishedTranslationTotal,
      localMediaTotal,
      languageStats,
      recentImports
    ] = await Promise.all([
      PostModel.countDocuments({ recordKind: SOURCE_RECORD_KIND }),
      getSourceGroupTotal(PostModel),
      PostModel.countDocuments({
        recordKind: TRANSLATION_RECORD_KIND,
        pendingReview: true
      }),
      PostModel.countDocuments({
        recordKind: TRANSLATION_RECORD_KIND,
        status: 1
      }),
      AttachmentModel.countDocuments({
        recordKind: TRANSLATION_RECORD_KIND,
        mediaMode: 'local'
      }),
      getLanguageStats(PostModel),
      PostModel.find({ recordKind: SOURCE_RECORD_KIND })
        .select(
          'title excerpt alias type status sourceId sourceLanguageCode sourceSnapshotAt snapshotVersion translationGroupId updatedAt'
        )
        .sort({ sourceSnapshotAt: -1, _id: -1 })
        .limit(5)
        .lean()
    ])
    const recentImportsWithSummary =
      await attachRecentImportTranslationSummary(recentImports)

    res.send({
      data: {
        sourceSnapshotTotal,
        sourceGroupTotal,
        pendingReviewTotal,
        publishedTranslationTotal,
        localMediaTotal,
        languageStats,
        recentImports: recentImportsWithSummary
      }
    })
  } catch (error) {
    handleApiError(res, error)
  }
}
