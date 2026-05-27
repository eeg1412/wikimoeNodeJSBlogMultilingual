# AI 调用与 Token 成本全量巡检报告

生成日期：2026-05-27

## 结论先说

当前代码里没有发现前端绕过后端、私自直接调用 DeepSeek/Gemini 的情况。AI 调用集中在服务端 multilingual-admin 的几个 service 中，主要成本来自翻译任务链路本身：专有名词抽取、候选词消歧、官方译名知识库整理、Gemini 联网补齐、正文分块翻译、封面图识别和封面图生成。

真正需要立刻控制的不是“某个地方随便循环调用 AI”，而是下面三类确定会放大请求数的机制：

1. `runAiStepWithRetry` 默认最多 3 次，且 `AI_TRANSLATION_FAILED` 默认可重试；业务校验失败也可能整步重跑。
2. Gemini 联网检索先主请求，再按缺失 termRequest 补齐；当前只补齐 1 轮，批大小 50，但旧批大小 1 会明显放大请求次数。
3. 专有名词候选消歧已有分流结构，但当前 `shouldFilterExistingTermWithAi` 对任意非空候选都返回 true，单候选也会走 AI 判断。

优先级建议：先做 P0 的“重试分流 + 联网检索预算 + AI 请求计数展示”，再做 P1 的“候选词消歧短路 + chunk 参数配置化”。

## 审计口径

本次按当前工作区代码重新检查，不沿用旧印象。全库检索关键词包括 DeepSeek、Gemini、generateContent、requestProviderJson、requestProviderStream、sendGeminiNativeGenerateContentRequest、aiUsage、imageRecognition、imageGeneration、AI_TRANSLATION。

直接 AI 请求入口集中在：

- [server/api/multilingual-admin/services/textAiProviderRequestService.js](server/api/multilingual-admin/services/textAiProviderRequestService.js)：DeepSeek/Gemini 文本请求统一封装。
- [server/api/multilingual-admin/services/geminiNativeApiService.js](server/api/multilingual-admin/services/geminiNativeApiService.js)：Gemini 原生 `generateContent` 请求封装。
- [server/api/multilingual-admin/services/deepSeekTranslationService.js](server/api/multilingual-admin/services/deepSeekTranslationService.js)：正文翻译、专有名词抽取、候选词消歧。
- [server/api/multilingual-admin/services/internetSearchAiService.js](server/api/multilingual-admin/services/internetSearchAiService.js)：官方译名知识库整理与 Gemini 联网搜索。
- [server/api/multilingual-admin/services/coverImageTranslationService.js](server/api/multilingual-admin/services/coverImageTranslationService.js)：封面图识别和生成编排。
- [server/api/multilingual-admin/services/geminiImageRecognitionService.js](server/api/multilingual-admin/services/geminiImageRecognitionService.js)：Gemini 图像识别。
- [server/api/multilingual-admin/services/geminiImageGenerationService.js](server/api/multilingual-admin/services/geminiImageGenerationService.js)：Gemini 图像生成。

admin 前端只调用后端接口，例如 [admin/src/api/module/multilingual.js](admin/src/api/module/multilingual.js) 和 [admin/src/components/ProperNounInternetSearchDialog.vue](admin/src/components/ProperNounInternetSearchDialog.vue)，没有发现前端直接调用 AI provider。

## 当前 AI 调用地图

### 文本 provider

[textAiProviderRequestService.js](server/api/multilingual-admin/services/textAiProviderRequestService.js) 中：

- `requestProviderJson`：Gemini 走 `sendGeminiNativeGenerateContentRequest`，DeepSeek 走 DeepSeek JSON 请求。
- `requestProviderStream`：DeepSeek 走流式请求；Gemini 没有真正流式，内部退化为一次 JSON 请求后把完整文本作为 chunk 输出。

成本含义：同一个上层“流式翻译”步骤，如果 provider 是 Gemini，代码层面仍是一批一次 Gemini 请求，不是持续多次请求。

### 专有名词链路

[deepSeekTranslationService.js](server/api/multilingual-admin/services/deepSeekTranslationService.js) 中：

- `extractTermsFromPackage`：每个 package 一次 AI 请求，并包在 `runAiStepWithRetry` 里。
- `filterExistingTermCandidatesWithAi`：候选词消歧一次 AI 请求，并包在 `runAiStepWithRetry` 里。
- `getOfficialTermGlossaryCacheData`：有 `officialTermGlossaryTaskCache`，可在同任务内复用专有名词词库整理结果。

[internetSearchAiService.js](server/api/multilingual-admin/services/internetSearchAiService.js) 中：

- `requestOfficialTermKnowledgeTranslations`：官方译名知识库整理，provider 可为 DeepSeek 或 Gemini，并包在 `runAiStepWithRetry` 里。
- `searchOfficialTermTranslationsWithInternet`：Gemini 联网检索，主请求加补齐请求，整个搜索步骤包在 `runAiStepWithRetry` 里。

### 正文翻译链路

[deepSeekTranslationService.js](server/api/multilingual-admin/services/deepSeekTranslationService.js) 中：

- 非流式 `translatePreparedEntries`：一次 AI JSON 请求。
- 流式 `translatePreparedEntriesStream`：先拆 chunk，再每个 chunk 调用 `translateStreamChunkWithRetry`。
- `translateStreamChunkWithRetry`：每个 chunk 一次 AI 请求，并包在 `runAiStepWithRetry` 里。
- chunk cache 会写入文件，并由 `cacheKey + scopeKey + chunkIndex + chunkInputHash` 控制命中。

### 封面图链路

[coverImageTranslationService.js](server/api/multilingual-admin/services/coverImageTranslationService.js) 中：

- AUTO 模式：先 Gemini 图像识别，确认需要翻译后再 Gemini 图像生成。
- ALWAYS 模式：跳过识别，直接生成。
- NEVER 模式：不做封面图 AI。
- 单次 registry 内有 `recognitionMap` 和 `generationMap` 去重。

图像识别和生成没有经过 `runAiStepWithRetry`，所以不会被通用 3 次重试放大；但跨任务没有持久化复用。

## 确定风险 1：通用重试会放大整条 AI 链路

证据：

- 默认最大次数：[server/api/multilingual-admin/services/aiStepRetryService.js](server/api/multilingual-admin/services/aiStepRetryService.js#L5)
- 可重试判断：[server/api/multilingual-admin/services/aiStepRetryService.js](server/api/multilingual-admin/services/aiStepRetryService.js#L64-L80)
- 重试循环：[server/api/multilingual-admin/services/aiStepRetryService.js](server/api/multilingual-admin/services/aiStepRetryService.js#L177-L279)

当前规则：

```text
DEFAULT_AI_STEP_MAX_ATTEMPTS = 3
ApiError.code === AI_TRANSLATION_FAILED 且没有 retryable:false => 可重试
```

这个设计对网络超时、上游 5xx、连接中断有价值。但当前大量业务校验错误也使用 `AI_TRANSLATION_FAILED`，例如 JSON 结构不合法、缺少字段、缺少名词译名、富文本片段缺失。它们没有统一标记 `retryable:false`，所以可能触发同一个 AI 步骤重复执行。

成本影响：

```text
某步骤实际请求数 = 单次执行请求数 * 最多 3 次尝试
```

如果这个步骤内部还有“主请求 + 补齐请求”，重试会把内部请求链整体重跑。

建议修法：

1. 增加错误分类：provider 临时错误可重试，业务校验错误默认不可重试。
2. JSON parse 失败可以单独设置最多 1 次重试，不跟网络错误同级。
3. 最终缺失名词译名、sourceText 不匹配、字段策略失败，应抛 `retryable:false`。

## 确定风险 2：Gemini 联网补齐缺少请求预算

证据：

- 当前常量：[server/api/multilingual-admin/services/internetSearchAiService.js](server/api/multilingual-admin/services/internetSearchAiService.js#L38-L39)
- 补齐循环：[server/api/multilingual-admin/services/internetSearchAiService.js](server/api/multilingual-admin/services/internetSearchAiService.js#L1738-L1778)
- 最终缺失报错：[server/api/multilingual-admin/services/internetSearchAiService.js](server/api/multilingual-admin/services/internetSearchAiService.js#L1806-L1807)

当前代码值：

```text
OFFICIAL_TERM_SEARCH_REPAIR_MAX_ROUNDS = 1
OFFICIAL_TERM_SEARCH_REPAIR_BATCH_TERM_COUNT = 50
```

请求公式要按 `missingTermRequests.length` 算，不是按 UI 日志里的 missingParts 数直接算。`missingParts` 是 sourceText/languageCode 对；一个 termRequest 可能包含多个目标语言。

当前一轮补齐公式：

```text
单次搜索尝试请求数 = 1 次主请求 + ceil(missingTermRequests.length / batchSize)
最坏请求数 = 单次搜索尝试请求数 * 3 次 AI step 重试
```

如果旧配置 `batchSize = 1`，且主请求后有 8 个 missingTermRequests：

```text
单次尝试 = 1 + 8 = 9 次 Gemini 请求
最坏 = 9 * 3 = 27 次 Gemini 请求
```

如果主请求后有 16 个 missingTermRequests：

```text
单次尝试 = 1 + 16 = 17 次 Gemini 请求
最坏 = 17 * 3 = 51 次 Gemini 请求
```

当前 `batchSize = 50` 时，16 个 missingTermRequests：

```text
单次尝试 = 1 + 1 = 2 次 Gemini 请求
最坏 = 2 * 3 = 6 次 Gemini 请求
```

还要注意：一次 Gemini `google_search` grounding 请求在 provider 内部可能产生多个搜索子查询，代码无法直接等价估算内部搜索次数。

建议修法：

1. 给 `searchOfficialTermTranslationsWithInternet` 增加每任务最大 Gemini 请求数。
2. 给补齐阶段增加最大 missingTermRequests 数，超过预算直接返回待人工确认。
3. 预算耗尽时抛 `retryable:false`，避免通用重试把预算再跑三遍。
4. 任务日志中同时记录 `missingParts.length` 和 `missingTermRequests.length`，避免把“缺失译名对数”和“请求批次数”混在一起。

## 确定风险 3：候选词消歧的确定性短路没有生效

证据：

- 判定函数：[server/api/multilingual-admin/services/deepSeekTranslationService.js](server/api/multilingual-admin/services/deepSeekTranslationService.js#L2492-L2494)
- 分流函数：[server/api/multilingual-admin/services/deepSeekTranslationService.js](server/api/multilingual-admin/services/deepSeekTranslationService.js#L2496-L2535)
- AI 消歧请求：[server/api/multilingual-admin/services/deepSeekTranslationService.js](server/api/multilingual-admin/services/deepSeekTranslationService.js#L2912-L3034)

当前 `splitExistingTermCandidatesForFilter` 看起来支持自动匹配，但 `shouldFilterExistingTermWithAi` 的实现是：只要候选数组非空就返回 true。结果是：只要有候选词，就进入 AI 消歧；`autoMatchedTermLinks` 对非空候选基本不会生效。

这会浪费一次 AI 请求的典型场景：

- normalizedSourceText 精确匹配且只有一个候选词。
- 文章已绑定同一个 termId。
- 候选词译名已覆盖全部目标语言且不存在同名冲突。

建议修法：实现 `shouldFilterExistingTermWithAi`，让低风险场景直接 auto match。只有多候选、同名异义、文章绑定冲突、译名 note 冲突时才走 AI。

## 确定风险 4：专有名词抽取按内容长度线性增长

证据：

- package 构建：[server/api/multilingual-admin/services/deepSeekTranslationService.js](server/api/multilingual-admin/services/deepSeekTranslationService.js#L1597-L1658)
- 每包 AI 调用：[server/api/multilingual-admin/services/deepSeekTranslationService.js](server/api/multilingual-admin/services/deepSeekTranslationService.js#L2121-L2205)
- 顺序循环：[server/api/multilingual-admin/services/deepSeekTranslationService.js](server/api/multilingual-admin/services/deepSeekTranslationService.js#L2235-L2292)
- 当前文本切片常量：[server/api/multilingual-admin/services/deepSeekTranslationService.js](server/api/multilingual-admin/services/deepSeekTranslationService.js#L55-L58)

当前逻辑会把标题、摘要、关联内容作为 overview package，把正文按 `MAX_TERM_EXTRACTION_TEXT_SLICE_LENGTH = 8000` 切成 articleContent package。每个 package 一次 AI 名词抽取，并携带 previousContextSummary。

这是合理功能，不是 bug。但长文会天然产生更多请求：

```text
名词抽取请求数 = overviewPackageCount + articleContentPackageCount
```

建议修法：

1. 先用已有词库、本地关键词、文章绑定关系做预命中。
2. 对短文或纯普通正文允许跳过名词抽取。
3. 按 source snapshot + entries hash 缓存抽取结果。
4. 在任务日志里显示 packageCount 和最终有效 termCount。

## 确定风险 5：正文 chunk 上限固定为 6000，长文请求数偏保守

证据：

- 常量：[server/api/multilingual-admin/services/deepSeekTranslationService.js](server/api/multilingual-admin/services/deepSeekTranslationService.js#L43-L55)
- chunk limit 计算：[server/api/multilingual-admin/services/deepSeekTranslationService.js](server/api/multilingual-admin/services/deepSeekTranslationService.js#L961-L1029)
- chunk 翻译循环：[server/api/multilingual-admin/services/deepSeekTranslationService.js](server/api/multilingual-admin/services/deepSeekTranslationService.js#L5380-L5455)

`getTranslationChunkTextLimit` 会参考 `deepSeekMaxTokens`、JSON 输出预留、DeepSeek Thinking 预留，最后再被 `MAX_AI_REQUEST_TEXT_LENGTH = 6000` 截断。

这不是滥用 AI，而是偏安全的上限。问题是当模型上下文和输出 token 足够大时，仍然最多按 6000 字符拆 chunk，长文会产生更多请求。

建议修法：把 6000 改成配置项或按 provider/model 能力计算。默认可以继续保守，但成本优先模式允许更大的 chunk。

## 确定风险 6：DeepSeek Thinking 与富文本上下文会增加 token

证据：

- Thinking 预留：[server/api/multilingual-admin/services/deepSeekTranslationService.js](server/api/multilingual-admin/services/deepSeekTranslationService.js#L976-L1002)
- chunk 文本上限：[server/api/multilingual-admin/services/deepSeekTranslationService.js](server/api/multilingual-admin/services/deepSeekTranslationService.js#L1005-L1019)
- 富文本上下文：[server/api/multilingual-admin/services/deepSeekTranslationService.js](server/api/multilingual-admin/services/deepSeekTranslationService.js#L1035-L1061)

DeepSeek Thinking 开启后会预留 35% token，`reasoningEffort=max` 预留 50%。这会降低单个 chunk 可承载的正文长度，间接增加 chunk 数。

富文本长 text 节点拆段时，每段最多带 160 字符 `contextBefore` 和 160 字符 `contextAfter`。这能提升翻译质量，但会重复送入上下文 token。

建议修法：

1. Thinking 只对高难度任务或失败重试启用，普通正文默认关闭或降低 effort。
2. 富文本上下文长度做成配置项，成本优先模式降到 60-80。
3. 记录上下文重复字符数，便于观察真实 token 成本。

## 确定风险 7：封面图 AI 只做单次任务内去重

证据：

- registry：[server/api/multilingual-admin/services/coverImageTranslationService.js](server/api/multilingual-admin/services/coverImageTranslationService.js#L80-L85)
- 识别缓存：[server/api/multilingual-admin/services/coverImageTranslationService.js](server/api/multilingual-admin/services/coverImageTranslationService.js#L1022-L1166)
- 生成缓存：[server/api/multilingual-admin/services/coverImageTranslationService.js](server/api/multilingual-admin/services/coverImageTranslationService.js#L1168-L1351)
- 批量分组：[server/api/multilingual-admin/services/coverImageTranslationService.js](server/api/multilingual-admin/services/coverImageTranslationService.js#L866-L903)

当前做得好的地方：

- 同一 registry 内，识别按 recognitionKey 复用。
- 同一 registry 内，生成按 generationKey 复用。
- 批量任务会按 source post + source title + target title 分组。
- 图像链路没有套 `runAiStepWithRetry`，不会自动 3 倍重试。

成本风险：registry 是本次执行内存对象，不是持久缓存。重复翻译同一源封面、同一目标标题时，新任务仍会重新识别/生成。

建议修法：持久化封面图识别/生成结果，key 至少包含源封面 hash、源标题、目标标题、目标语言、promptHash、provider、model。

## 确定风险 8：任务进度能看到重试状态，但缺少预算级调用计数

证据：

- AI usage 入库：[server/api/multilingual-admin/services/aiUsageService.js](server/api/multilingual-admin/services/aiUsageService.js#L62-L92)
- AI workflow 进度事件：[server/api/multilingual-admin/services/translationJobService.js](server/api/multilingual-admin/services/translationJobService.js#L1880-L1939)
- handlers 传递 workflow：[server/api/multilingual-admin/services/translationExecutionService.js](server/api/multilingual-admin/services/translationExecutionService.js#L500-L545)

当前已有 `aiUsageLogs`，也会记录 workflow attemptNo/maxAttempts。但是任务进度更偏“正在执行第几步”，没有统一展示本任务已发起多少次 AI 请求、其中多少次是补齐、多少次是重试、预计还能发多少次。

这不会直接增加成本，但会让操作者误判成本。比如“正在补齐 16 个缺失名词译名”容易被理解为一个动作，而不是可能拆成多次 Gemini 请求。

建议修法：在 task runtime 或 progress stageState 中增加 `aiCallBudget`/`aiCallStats`：

```text
plannedCallCount
actualCallCount
retryCallCount
internetSearchPrimaryCallCount
internetSearchRepairCallCount
imageRecognitionCallCount
imageGenerationCallCount
```

## 已确认不是问题或不能夸大的点

1. 当前不是“只有 DeepSeek 有问题”。DeepSeek/Gemini 都会经过通用文本 provider、JSON 校验和重试；Gemini 另外承担联网搜索和图片能力。
2. 当前 `OFFICIAL_TERM_SEARCH_REPAIR_MAX_ROUNDS` 是 1，不是 2。按两轮估算请求数是错误口径。
3. 当前 `OFFICIAL_TERM_SEARCH_REPAIR_BATCH_TERM_COUNT` 是 50。旧批大小 1 会放大请求，但当前代码已经不是 1。
4. 不能说“多语言一定重复完整名词搜索”。主翻译多语言循环会传同一个 `officialTermGlossaryTaskCache`，可复用同任务内词库整理结果：[server/api/multilingual-admin/services/translationExecutionService.js](server/api/multilingual-admin/services/translationExecutionService.js#L1701-L1717)。
5. 不能说“正文 chunk 完全没有缓存”。当前 chunk cache 会写文件，并支持 `sharedCacheKey` 覆盖关联任务：[server/api/multilingual-admin/services/aiLogFileService.js](server/api/multilingual-admin/services/aiLogFileService.js#L130-L235)、[server/api/multilingual-admin/services/translationExecutionService.js](server/api/multilingual-admin/services/translationExecutionService.js#L128-L141)。
6. 不能说“封面图完全逐项重复请求”。同一 registry 内已有 recognition/generation map 去重，问题是没有跨任务持久复用。
7. `ai-json-log` 和 `aiUsageLogs` 记录请求/响应摘要会增加存储压力，但它们不是 AI 请求本身，不应算作 AI 调用滥用。

## P0 修复清单

### P0-1：重试错误类型分流

目标：避免业务校验失败把整条 AI 链路跑 3 次。

建议改动：

- 增加 `createRetryableAiError` / `createNonRetryableAiValidationError` 之类的明确构造函数。
- provider timeout、5xx、429、连接中断保留可重试。
- schema/字段/缺失名词/最终补齐失败/sourceText 不匹配默认 `retryable:false`。
- JSON parse 失败单独最多 1 次重试。

### P0-2：联网检索预算控制

目标：避免一个任务内 Gemini 联网搜索请求失控。

建议改动：

- `searchOfficialTermTranslationsWithInternet` 内统计本次 search 的实际 Gemini 请求数。
- 配置最大 primary + repair 请求数，例如默认 3。
- 配置最大 repair termRequest 数，例如默认 50。
- 超预算时返回明确错误并 `retryable:false`。
- 日志显示 `missingTermRequests.length`、`missingParts.length`、`repairBatchCount`。

### P0-3：AI 请求计数展示

目标：让用户看到“这一步到底花了几次 AI”。

建议改动：

- 在 task progress 或 result 中聚合 request count。
- UI 展示当前步骤 AI 请求数、重试次数、补齐次数。
- 对联网搜索单独展示 primary/repair。

## P1 修复清单

### P1-1：候选词消歧短路

目标：能确定的候选词不再请求 AI。

建议规则：

- 单候选且 normalizedSourceText 精确匹配：auto match。
- 文章已绑定 termId 且无冲突：auto match。
- 多候选、别名冲突、note 冲突、目标语言覆盖冲突：走 AI。

### P1-2：chunk 和上下文配置化

目标：让成本优先/质量优先可调。

建议改动：

- `MAX_AI_REQUEST_TEXT_LENGTH` 改为配置项。
- `RICH_TEXT_SEGMENT_CONTEXT_LENGTH` 改为配置项。
- Thinking 策略按任务类型可选。

### P1-3：抽取与封面图持久缓存

目标：减少跨任务重复 AI。

建议改动：

- 专有名词抽取结果按 source snapshot + entries hash 缓存。
- 封面图识别/生成按源图 hash + promptHash + model 复用。

## 最终判断

当前最像“滥用 AI”的点不是 provider 选择，而是成本控制缺失：通用 3 次重试没有区分业务错误，联网搜索没有预算，候选词消歧的短路函数实际没短路。先修这三处，才能实质减少请求次数和 token 消耗。
