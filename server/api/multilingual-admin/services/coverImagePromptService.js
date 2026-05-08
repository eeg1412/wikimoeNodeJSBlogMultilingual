const { buildStableHash } = require('../utils/coverImageTranslationUtils')

function appendPrompt(basePrompt, businessPrompt) {
  const normalizedBasePrompt = String(basePrompt || '').trim()
  const normalizedBusinessPrompt = String(businessPrompt || '').trim()
  if (!normalizedBasePrompt) {
    return normalizedBusinessPrompt
  }
  if (!normalizedBusinessPrompt) {
    return normalizedBasePrompt
  }
  return `${normalizedBasePrompt}\n\n${normalizedBusinessPrompt}`
}

function formatTitleRegion(titleRegion) {
  const region = titleRegion || {}
  return [
    `x=${Number(region.x || 0)}`,
    `y=${Number(region.y || 0)}`,
    `width=${Number(region.width || 0)}`,
    `height=${Number(region.height || 0)}`
  ].join(', ')
}

function buildCoverRecognitionBusinessPrompt(options = {}) {
  return `任务名称：封面图标题识别

你将看到一张文章封面图。请判断图片中是否包含“源文章标题”或与源文章标题语义一致的主要标题文字。

源文章标题：
${options.sourceTitle || ''}

源语言：
${options.sourceLanguageCode || ''}

目标语言：
${options.targetLanguageCode || ''}

目标标题：
${options.targetTitle || ''}

判定范围：
1. 只判断图片上可见的文字内容，不判断文件名、alt、metadata、URL 或上下文说明。
2. 只把封面主标题、主视觉标题、醒目标题文字视为候选标题。
3. Logo、水印、站点名、作者名、日期、分类标签、按钮文字、角标、版权声明、背景装饰文字，不视为文章标题。
4. 如果图片中没有可读文字，containsTitle 必须为 false。
5. 如果图片中文字只和源标题部分相关，但不足以判断是标题，confidence 必须低于 0.75。
6. 如果图片中标题是源标题的同义表达、缩写、常见排版拆分，且明显承担封面主标题功能，可以判定为 true。
7. 不要因为目标标题存在于输入文本中，就认为图片包含目标标题；必须以图片可见内容为准。

输出要求：
1. 只输出 JSON。
2. 不要输出 Markdown。
3. 不要输出解释性段落。
4. 顶层 JSON 必须且只允许包含以下字段，字段名必须完全一致，不允许改名、不允许省略、不允许新增字段：schema、version、containsTitle、recognizedTitleText、confidence、titleRegion、reason、shouldTranslate。
5. schema 必须固定为 "wikimoe.ai.cover-image-recognition.result"。
6. version 必须固定为 1。
7. recognizedTitleText 必须是图片里实际看到的标题文字；如果没有识别到标题，必须返回空字符串 ""。
8. titleRegion 使用相对坐标，范围 0 到 1；如果无法定位标题区域，x/y/width/height 必须全部为 0。
9. reason 必须是简短字符串，用于解释判断原因。
10. shouldTranslate 只有在图片确实包含源文章标题，且 confidence >= ${options.confidenceThreshold || 0.75} 时才允许为 true。
11. 禁止输出 sourceLanguage、targetLanguage、originalTitleInImage、translatedTitle、titleFound、language 或任何其他未定义字段。
12. 严格按下面这个 JSON 对象结构输出，键名和层级必须完全一致：
{
  "schema": "wikimoe.ai.cover-image-recognition.result",
  "version": 1,
  "containsTitle": true,
  "recognizedTitleText": "图片中识别到的原标题文本",
  "confidence": 0.91,
  "titleRegion": {
    "x": 0.1,
    "y": 0.2,
    "width": 0.8,
    "height": 0.25
  },
  "reason": "简短说明判断依据",
  "shouldTranslate": true
}`
}

function buildCoverRecognitionPrompt(options = {}) {
  return appendPrompt(
    options.basePrompt,
    buildCoverRecognitionBusinessPrompt(options)
  )
}

function buildProviderGenerationSuffix(provider) {
  if (provider === 'openai') {
    return `Use the input image as the strict visual reference.
Preserve all non-title pixels as much as possible.
Only edit the detected title text region.
Return one final edited image.`
  }
  if (provider === 'nano-banana') {
    return `The source cover image is the reference image.
Keep the same composition and visual identity.
Edit only the title text area.
Do not redesign the cover.`
  }
  return ''
}

function buildCoverGenerationBusinessPrompt(options = {}) {
  const titleRegionText = formatTitleRegion(options.titleRegion)
  const providerSuffix = buildProviderGenerationSuffix(options.provider)
  const regionPrompt = `标题区域相对坐标：
${titleRegionText}

标题区域规则：
1. 优先在该区域内完成标题替换。
2. 如果目标标题放不下，可以向标题区域附近的空白区域扩展，但不得遮挡主体内容。
3. 不得在标题区域以外新增第二份标题。
4. 如果 titleRegion 全部为 0，表示识别模型无法定位标题区域；此时应根据输入图中的主标题视觉位置进行替换。`

  return `任务名称：封面图标题翻译图片编辑

你将基于输入封面图生成一张新的封面图。
目标：只把封面图中的文章标题文字替换为目标语言标题，并对标题区域重新排版。

源标题：
${options.sourceTitle || ''}

识别到的源标题文字：
${options.recognizedTitleText || ''}

源语言：
${options.sourceLanguageCode || ''}

目标标题：
${options.targetTitle || ''}

目标语言：
${options.targetLanguageCode || ''}

目标封面尺寸：
${options.targetWidth || 0} x ${options.targetHeight || 0}

目标画幅比例：
${options.selectedGenerationRatio || ''}

硬性规则：
1. 只允许修改文章标题文字和标题排版。
2. 必须保留原图的人物、背景、主体物体、构图、光影、色彩风格、纹理、边框、Logo、水印和非标题文字。
3. 禁止新增目标标题以外的文字。
4. 禁止删除、改写或翻译非标题文字。
5. 禁止改变图片主题、故事含义、人物表情、物品形状、场景位置。
6. 目标标题必须使用目标语言，必须清晰可读。
7. 标题排版必须自然，符合原封面的设计风格、字体气质、层级、对齐方式和留白。
8. 如果目标标题更长，允许重新换行、调整字号、字重、字间距和行距，但不得遮挡主体内容。
9. 如果原标题有描边、阴影、渐变、纹理、倾斜、透视、手写、像素风等样式，目标标题应尽量继承。
10. 输出应适合后续裁切到 ${options.targetWidth || 0} x ${options.targetHeight || 0}，重要内容不得贴边。
11. 不要输出多张图片，不要输出过程说明，不要输出文字解释。

${regionPrompt}

${providerSuffix}`
}

function buildCoverGenerationPrompt(options = {}) {
  const prompt = appendPrompt(
    options.basePrompt,
    buildCoverGenerationBusinessPrompt(options)
  )
  return {
    prompt,
    promptHash: buildStableHash([prompt])
  }
}

module.exports = {
  buildCoverGenerationPrompt,
  buildCoverRecognitionPrompt
}
