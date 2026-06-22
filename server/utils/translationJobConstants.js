const TRANSLATION_JOB_TYPES = Object.freeze({
  POST_AI_TRANSLATION: 'post-ai-translation',
  SOURCE_POST_AI_IMPORT: 'source-post-ai-import',
  SOURCE_POST_PROPER_NOUN_ORGANIZE: 'source-post-proper-noun-organize',
  CONTENT_AI_TRANSLATION: 'content-ai-translation'
})

const TRANSLATION_JOB_TYPE_VALUES = Object.freeze(
  Object.values(TRANSLATION_JOB_TYPES)
)

const TRANSLATION_JOB_STATUS = Object.freeze({
  PENDING: '未开始',
  RUNNING: '执行中',
  FAILED: '执行失败',
  BLOCKED: '已阻塞',
  WAITING_REVIEW: '等待审核',
  REJECTED: '不采纳',
  PARTIAL_ADOPTED: '部分采纳',
  FULLY_ADOPTED: '完全采纳'
})

const TRANSLATION_JOB_STATUS_VALUES = Object.freeze(
  Object.values(TRANSLATION_JOB_STATUS)
)

const TRANSLATION_JOB_FINAL_STATUS_VALUES = Object.freeze([
  TRANSLATION_JOB_STATUS.REJECTED,
  TRANSLATION_JOB_STATUS.PARTIAL_ADOPTED,
  TRANSLATION_JOB_STATUS.FULLY_ADOPTED
])

const TRANSLATION_JOB_DELETE_ALLOWED_STATUS_VALUES = Object.freeze([
  TRANSLATION_JOB_STATUS.PENDING,
  TRANSLATION_JOB_STATUS.FAILED,
  TRANSLATION_JOB_STATUS.BLOCKED,
  ...TRANSLATION_JOB_FINAL_STATUS_VALUES
])

// 任务在家族（root/parent/child）中的角色。
// root   = 整个翻译家族的编排器（代表一次"翻译全部语言"请求）
// parent = 单篇文章（根文章或某个相关文章）的编排器
// child  = 真正执行 AI 的步骤子任务
// standalone = 不属于任何家族、独立运行的主任务
const TRANSLATION_JOB_TASK_ROLES = Object.freeze({
  STANDALONE: 'standalone',
  ROOT: 'root',
  PARENT: 'parent',
  CHILD: 'child'
})

const TRANSLATION_JOB_TASK_ROLE_VALUES = Object.freeze(
  Object.values(TRANSLATION_JOB_TASK_ROLES)
)

// 编排型任务角色：本身不执行 AI，只负责派生与聚合子任务状态。
const TRANSLATION_JOB_ORCHESTRATOR_ROLE_VALUES = Object.freeze([
  TRANSLATION_JOB_TASK_ROLES.ROOT,
  TRANSLATION_JOB_TASK_ROLES.PARENT
])

// 子任务步骤种类（child.kind）。每种 kind 对应一个可独立运行、也可被父任务编排的执行模块。
// proper-noun-organize       = 名词整理（针对该文章所有目标语言一次性整理，执行即生效）
// single-language-translation = 单语言翻译校验（每种目标语言一个子任务）
// cover-image-organize       = 封面图整理（家族最后一步，跨该文章各语言按标题去重）
// post-language-translation  = 已有译文文章的单语言翻译（批量"翻译已存在文章"时，每种目标语言一个子任务）
const TRANSLATION_JOB_CHILD_KINDS = Object.freeze({
  PROPER_NOUN_ORGANIZE: 'proper-noun-organize',
  SINGLE_LANGUAGE_TRANSLATION: 'single-language-translation',
  COVER_IMAGE_ORGANIZE: 'cover-image-organize',
  POST_LANGUAGE_TRANSLATION: 'post-language-translation'
})

const TRANSLATION_JOB_CHILD_KIND_VALUES = Object.freeze(
  Object.values(TRANSLATION_JOB_CHILD_KINDS)
)

// 需要人工审核采纳的子任务种类（名词整理执行即生效，不参与统一采纳）。
const TRANSLATION_JOB_ADOPTABLE_CHILD_KINDS = Object.freeze([
  TRANSLATION_JOB_CHILD_KINDS.SINGLE_LANGUAGE_TRANSLATION,
  TRANSLATION_JOB_CHILD_KINDS.COVER_IMAGE_ORGANIZE,
  TRANSLATION_JOB_CHILD_KINDS.POST_LANGUAGE_TRANSLATION
])

module.exports = {
  TRANSLATION_JOB_TYPES,
  TRANSLATION_JOB_TYPE_VALUES,
  TRANSLATION_JOB_STATUS,
  TRANSLATION_JOB_STATUS_VALUES,
  TRANSLATION_JOB_FINAL_STATUS_VALUES,
  TRANSLATION_JOB_DELETE_ALLOWED_STATUS_VALUES,
  TRANSLATION_JOB_TASK_ROLES,
  TRANSLATION_JOB_TASK_ROLE_VALUES,
  TRANSLATION_JOB_ORCHESTRATOR_ROLE_VALUES,
  TRANSLATION_JOB_CHILD_KINDS,
  TRANSLATION_JOB_CHILD_KIND_VALUES,
  TRANSLATION_JOB_ADOPTABLE_CHILD_KINDS
}
