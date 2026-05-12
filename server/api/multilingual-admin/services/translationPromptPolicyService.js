const GENERAL_TRANSLATION_QUALITY_POLICY_LINES = [
  '翻译必须符合“信、达、雅”：忠实原意和语气，目标语言表达通顺，并尽量自然雅致。',
  '原文中有意保留的异语片段或已经是目标语言的内容，不要强行翻译；只有为了理解、上下文统一或用户明确要求时才翻译。'
]

const TERM_TRANSLATION_QUALITY_POLICY_LINES = [
  '名词和名称翻译必须符合“信、达、雅”：保持对象身份和官方用法，优先使用官方译名、权威译名或稳定通用译名。',
  '不要凭直译、音译或模糊印象猜测译名；原文有意保留的异语名称或已经是目标语言的名称，不要强行翻译。'
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

module.exports = {
  getGeneralTranslationQualityPolicyLines,
  getGeneralTranslationQualityPolicyText,
  getTermTranslationQualityPolicyLines,
  getTermTranslationQualityPolicyText
}
