// 导入任务状态与阶段
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
  IMPORT_JOB_STATUS,
  IMPORT_JOB_STATUS_VALUES: Object.values(IMPORT_JOB_STATUS),
  IMPORT_JOB_STAGE,
  IMPORT_JOB_STAGE_VALUES: Object.values(IMPORT_JOB_STAGE)
}
