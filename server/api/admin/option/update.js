import { optionUpdateSchema } from '../../../../common/validation/schemas.js'
import { validateData } from '../../../../common/validation/validate.js'
import { setOptionValue, setOptionValues } from '../../../config/optionsInit.js'
import { refreshGlobalConfig } from '../../../config/globalConfig.js'

export default async function optionUpdateHandler(req, res, next) {
  try {
    const { value, error } = validateData(optionUpdateSchema, req.body)
    if (error) {
      return res.status(400).json({ errors: [{ message: error }] })
    }

    const updatedBy = String(req.adminUser._id)

    let namespaces = []
    if (Array.isArray(value.optionList)) {
      namespaces = [...new Set(value.optionList.map(item => item.namespace))]
      await setOptionValues(value.optionList, updatedBy)
    } else {
      const { namespace, key, value: optionValue } = value
      namespaces = [namespace]
      await setOptionValue(namespace, key, optionValue, updatedBy)
    }

    // 刷新进程内配置缓存
    if (namespaces.length === 1) {
      await refreshGlobalConfig(namespaces[0])
    } else {
      await refreshGlobalConfig()
    }

    return res.json({ data: { updated: true } })
  } catch (err) {
    next(err)
  }
}
