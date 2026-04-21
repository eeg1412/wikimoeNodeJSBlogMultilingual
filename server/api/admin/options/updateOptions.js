const {
  optionUpdateSchema,
  validateSingleOption
} = require('@wikimoe-ml/common/validation')
const { setOption, getAllOptions } = require('../../../utils/options')
const cacheManager = require('../../../utils/cache')
const { badRequest } = require('../../../utils/errors')

/**
 * POST /api/admin/options/update
 * body: { updates: { key: value, ... } }
 * - 每个 key 单独校验
 * - 批量 upsert 到 options 集合
 * - 调整后立即失效 options / seo / 语言缓存
 */
module.exports = async function updateOptionsApi(req, res) {
  const { value, error } = optionUpdateSchema.validate(req.body || {}, {
    abortEarly: false,
    stripUnknown: true
  })
  if (error) throw badRequest('参数校验失败', error.details)

  const updates = value.updates
  const accepted = {}
  const rejected = []
  for (const key of Object.keys(updates)) {
    const singleResult = validateSingleOption(key, updates[key])
    if (singleResult.error) {
      rejected.push({ key, message: singleResult.error.message })
      continue
    }
    await setOption(
      key,
      singleResult.value !== undefined ? singleResult.value : updates[key]
    )
    accepted[key] = updates[key]
  }

  if (rejected.length) {
    throw badRequest('部分选项校验失败', { rejected })
  }

  // 变更后统一失效缓存：options + SEO + 所有语言（siteUrl、siteDefaultLanguageCode、谷歌广告等都会影响）
  cacheManager.invalidateOptions()
  cacheManager.invalidateAllLanguages()

  const merged = await getAllOptions()
  res.json({ data: { updated: Object.keys(accepted), options: merged } })
}
