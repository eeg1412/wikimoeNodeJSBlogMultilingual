const { createObjectHash } = require('../../../common/utils/hash')

function pickTranslationStatus(existingRecord, nextSourceHash) {
  if (!existingRecord) {
    return 'pending'
  }

  if (existingRecord.sourceHash === nextSourceHash) {
    return existingRecord.translationStatus || 'pending'
  }

  return 'outdated'
}

function createSharedEntityService(modelUtils, mapEntity) {
  return {
    upsert: async function (entity, languageCode) {
      if (!entity || !entity._id) {
        return null
      }

      const mappedEntity = mapEntity(entity)
      const sourceHash = createObjectHash(mappedEntity)
      const existingRecord = await modelUtils.findOne({
        sourceId: String(entity._id),
        languageCode
      })
      const translationStatus = pickTranslationStatus(
        existingRecord,
        sourceHash
      )

      const savedRecord = await modelUtils.findOneAndUpdate(
        {
          sourceId: String(entity._id),
          languageCode
        },
        {
          $set: {
            ...mappedEntity,
            sourceId: String(entity._id),
            languageCode,
            sourceSnapshot: mappedEntity,
            sourceHash,
            translationStatus
          },
          $setOnInsert: {
            isManualEdited: false
          }
        },
        {
          upsert: true,
          new: true
        }
      )

      return savedRecord
    }
  }
}

module.exports = {
  createSharedEntityService
}
