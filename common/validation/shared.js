const Joi = require('joi')
const {
  ATTACHMENT_SOURCE_TYPE,
  IMPORT_JOB_STAGE,
  IMPORT_JOB_STATUS,
  POST_STATUS,
  SUPPORTED_LANGUAGE_CODES,
  TRANSLATION_STATUS_LIST
} = require('../constants')

const languageCodeSchema = Joi.string()
  .valid(...SUPPORTED_LANGUAGE_CODES)
  .required()

const idOrAliasSchema = Joi.string().trim().min(1).max(64)

const translationStatusSchema = Joi.string().valid(...TRANSLATION_STATUS_LIST)

const attachmentSourceTypeSchema = Joi.string().valid(
  ATTACHMENT_SOURCE_TYPE.REMOTE,
  ATTACHMENT_SOURCE_TYPE.LOCALIZED
)

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  keyword: Joi.string().allow('', null),
  languageCode: languageCodeSchema.optional(),
  status: Joi.number()
    .valid(...Object.values(POST_STATUS))
    .optional(),
  translationStatus: translationStatusSchema.optional()
})

const importJobStatusSchema = Joi.string().valid(...Object.values(IMPORT_JOB_STATUS))
const importJobStageSchema = Joi.string().valid(...Object.values(IMPORT_JOB_STAGE))

module.exports = {
  attachmentSourceTypeSchema,
  idOrAliasSchema,
  importJobStageSchema,
  importJobStatusSchema,
  languageCodeSchema,
  paginationSchema,
  translationStatusSchema
}