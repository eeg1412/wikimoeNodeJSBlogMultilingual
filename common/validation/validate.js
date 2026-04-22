/**
 * 通用 Joi 校验中间件
 * 使用示例：
 *   router.post('/login', validate(loginSchema), handler)
 */

/**
 * @param {import('joi').Schema} schema
 * @param {'body'|'query'|'params'} source
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const data = req[source]
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true
    })
    if (error) {
      return res.status(400).json({
        errors: error.details.map(d => ({
          message: d.message,
          field: d.context?.key
        }))
      })
    }
    req[source] = value
    next()
  }
}

/**
 * 校验并返回结果（服务层使用，不依赖 Express）
 * @param {import('joi').Schema} schema
 * @param {object} data
 * @returns {{ value: object, error: string|null }}
 */
export function validateData(schema, data) {
  const { error, value } = schema.validate(data, {
    abortEarly: false,
    stripUnknown: true
  })
  if (error) {
    const msg = error.details.map(d => d.message).join('; ')
    return { value: null, error: msg }
  }
  return { value, error: null }
}
