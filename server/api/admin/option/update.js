import { optionUpdateSchema } from '../../../../common/validation/schemas.js'
import { validateData } from '../../../../common/validation/validate.js'
import { setOptionValue } from '../../../config/optionsInit.js'
import { refreshGlobalConfig } from '../../../config/globalConfig.js'

export default async function optionUpdateHandler(req, res, next) {
  try {
    const { value, error } = validateData(optionUpdateSchema, req.body)
    if (error) {
      return res.status(400).json({ errors: [{ message: error }] })
    }

    const { namespace, key, value: optionValue } = value
    const updatedBy = String(req.adminUser._id)

    await setOptionValue(namespace, key, optionValue, updatedBy)

    // 刷新进程内配置缓存
    await refreshGlobalConfig()

    return res.json({ data: { updated: true } })
  } catch (err) {
    next(err)
  }
}
