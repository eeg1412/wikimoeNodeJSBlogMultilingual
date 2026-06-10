import { getLanguageText } from '@/utils/multilingual'

export const progressStageTextMap = {
  pending: '等待领取',
  claimed: '已领取任务',
  BuildEntries: '构建翻译条目',
  TranslatePost: '翻译文章',
  TranslateCoverImage: '翻译封面图',
  TranslateContent: '翻译内容',
  OrganizeProperNouns: '整理文章名词',
  BindProperNouns: '关联文章名词',
  ImportSourceSnapshot: '导入源快照',
  OverwriteSourceSnapshot: '覆盖源快照',
  PrepareTargetPost: '准备目标文章',
  ValidateJob: '校验任务',
  ValidateTranslation: '校验译文',
  ValidationOverview: '全局校验速览',
  FinalizeProperNounOrganize: '完成名词整理',
  FinalizeReview: '整理审核结果'
}

function normalizeStageText(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  return String(value).trim()
}

export function getProgressStageText(stage) {
  const normalizedStage = normalizeStageText(stage)
  if (!normalizedStage) {
    return '-'
  }
  if (progressStageTextMap[normalizedStage]) {
    return progressStageTextMap[normalizedStage]
  }
  const [stageName, languageCode] = normalizedStage.split(':')
  if (progressStageTextMap[stageName] && languageCode) {
    return `${progressStageTextMap[stageName]}（${getLanguageText(languageCode)}）`
  }
  return normalizedStage
}
