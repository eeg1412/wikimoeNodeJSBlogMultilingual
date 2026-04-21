const HttpError = require('./httpError')

function validate(schema, payload) {
  const result = schema.validate(payload, {
    abortEarly: false,
    convert: true,
    stripUnknown: true
  })

  if (result.error) {
    throw new HttpError(400, '参数校验失败', result.error.details)
  }

  return result.value
}

module.exports = {
  validate
}