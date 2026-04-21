const TRANSLATION_STATUS = {
  PENDING: 'pending',
  AI_DRAFT: 'ai_draft',
  MANUAL_DRAFT: 'manual_draft',
  APPROVED: 'approved',
  NOT_REQUIRED: 'not_required',
  STUB: 'stub',
  OUTDATED: 'outdated'
}

const TRANSLATION_STATUS_LIST = Object.values(TRANSLATION_STATUS)

const ATTACHMENT_SOURCE_TYPE = {
  REMOTE: 'remote',
  LOCALIZED: 'localized'
}

const ATTACHMENT_IMPORT_ORIGIN = {
  SOURCE_ATTACHMENT: 'sourceAttachment',
  HTML_DISCOVERED: 'htmlDiscovered',
  LOCALIZED_UPLOAD: 'localizedUpload',
  LOCALIZED_DERIVED: 'localizedDerived'
}

const IMPORT_JOB_STATUS = {
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
}

const IMPORT_JOB_STAGE = {
  RESOLVE_SOURCE: 'resolveSource',
  EXTRACT_DEPENDENCIES: 'extractDependencies',
  UPSERT_SHARED_ENTITIES: 'upsertSharedEntities',
  UPSERT_POST: 'upsertPost',
  FINALIZE: 'finalize'
}

module.exports = {
  ATTACHMENT_IMPORT_ORIGIN,
  ATTACHMENT_SOURCE_TYPE,
  IMPORT_JOB_STAGE,
  IMPORT_JOB_STATUS,
  TRANSLATION_STATUS,
  TRANSLATION_STATUS_LIST
}