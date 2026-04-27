const { SUPPORTED_LANGUAGE_CODES } = require('../../../utils/language')
const { handleApiError } = require('../../../utils/multilingualAdminResponse')

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

async function attachRecentImportTranslationSummary(PostModel, recentImports) {
  const groupIds = recentImports
    .map(item => item.translationGroupId)
    .filter(Boolean)

  if (groupIds.length === 0) {
    return recentImports
  }

  const rows = await PostModel.aggregate([
    {
      $match: {
        recordKind: TRANSLATION_RECORD_KIND,
        translationGroupId: { $in: groupIds }
      }
    },
    {
      $group: {
        _id: '$translationGroupId',
        total: { $sum: 1 },
        published: {
          $sum: {
            $cond: [{ $eq: ['$status', 1] }, 1, 0]
          }
        },
        pendingReview: {
          $sum: {
            $cond: ['$pendingReview', 1, 0]
          }
        }
      }
    }
  ])

  const summaryMap = new Map()
  for (const row of rows) {
    summaryMap.set(String(row._id), row)
  }

  return recentImports.map(item => ({
    ...item,
    translationSummary: summaryMap.get(String(item.translationGroupId)) || {
      total: 0,
      published: 0,
      pendingReview: 0
    }
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
    const recentImportsWithSummary = await attachRecentImportTranslationSummary(
      PostModel,
      recentImports
    )

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
