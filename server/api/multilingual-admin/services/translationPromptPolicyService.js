const GENERAL_TRANSLATION_QUALITY_POLICY_LINES = [
  '翻译必须符合“信、达、雅”：忠实原意和语气，目标语言表达通顺，并尽量自然雅致。',
  '原文中有意保留的异语片段或已经是目标语言的内容，不要强行翻译；只有为了理解、上下文统一或用户明确要求时才翻译。'
]

const TERM_TRANSLATION_QUALITY_POLICY_LINES = [
  '名词和名称翻译必须符合“信、达、雅”：保持对象身份和官方用法，优先使用可验证的官方译名、权威译名或稳定通用译名。',
  '专有名词译名必须以可验证的既有译名为准；不要把直译、音译、意译、风格化改写或模糊印象当作官方译名、权威译名或稳定通用译名。',
  '不要凭直译、音译或模糊印象猜测译名；原文有意保留的异语名称或已经是目标语言的名称，不要强行翻译。'
]

const GEMINI_TERM_KNOWLEDGE_PROMPT_LINES = [
  '请为每个 sourceText 在指定目标语言中给出官方译名、正式译名、权威通行译名或稳定通用译名。',
  'sourceTermRequests 旁可能包含 contentContextSummary；它概括这些名词在本次内容中的作品、角色、主题、关系和场景。',
  '确认译名时必须优先按 contentContextSummary 识别对象身份；短人名、昵称、单字名或同形异义词不能只按字面普通词处理。',
  '只有当译名属于世界级通用常识、长期稳定且你能确定对象身份时，才直接写入 translations。',
  '像“江户时代”“新干线”“东京塔”这类历史时期、公共交通或现实地标，如果目标语言里的稳定通用译名非常明确，可以使用内置知识完成。',
  '对于 ACG 作品、角色、声优、游戏、出版社、活动名、联名企划、地区性品牌、小众地点、新近作品、标题标点存在差异的词条，只要缺少可确信的正式来源，就必须把对应 language code 放入 needsSearchLanguageCodes。',
  '不要凭模糊印象、常见译法或可能的直译音译直接补 translations；不确定时交给后续互联网检索。',
  '如果目标语言确实没有固定译名，但这一结论需要查证，也应放入 needsSearchLanguageCodes，由联网检索阶段确认后再直译或音译。'
]

function cloneLines(lines) {
  return lines.slice()
}

function joinLines(lines) {
  return lines.join('\n')
}

function getGeneralTranslationQualityPolicyLines() {
  return cloneLines(GENERAL_TRANSLATION_QUALITY_POLICY_LINES)
}

function getGeneralTranslationQualityPolicyText() {
  return joinLines(GENERAL_TRANSLATION_QUALITY_POLICY_LINES)
}

function getTermTranslationQualityPolicyLines() {
  return cloneLines(TERM_TRANSLATION_QUALITY_POLICY_LINES)
}

function getTermTranslationQualityPolicyText() {
  return joinLines(TERM_TRANSLATION_QUALITY_POLICY_LINES)
}

function getGeminiTermKnowledgePromptLines() {
  return cloneLines(GEMINI_TERM_KNOWLEDGE_PROMPT_LINES)
}

function getGeminiTermKnowledgePromptText() {
  return joinLines(GEMINI_TERM_KNOWLEDGE_PROMPT_LINES)
}

module.exports = {
  getGeneralTranslationQualityPolicyLines,
  getGeneralTranslationQualityPolicyText,
  getTermTranslationQualityPolicyLines,
  getTermTranslationQualityPolicyText,
  getGeminiTermKnowledgePromptLines,
  getGeminiTermKnowledgePromptText
}
