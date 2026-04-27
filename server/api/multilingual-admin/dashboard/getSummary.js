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
      PostModel.countDocuments({ recordKind: SOURCE_RECORD_KIND }),
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
          'title alias type sourceLanguageCode sourceSnapshotAt snapshotVersion'
        )
        .sort({ sourceSnapshotAt: -1, _id: -1 })
        .limit(5)
        .lean()
    ])

    res.send({
      data: {
        sourceSnapshotTotal,
        sourceGroupTotal,
        pendingReviewTotal,
        publishedTranslationTotal,
        localMediaTotal,
        languageStats,
        recentImports
      }
    })
  } catch (error) {
    handleApiError(res, error)
  }
}
