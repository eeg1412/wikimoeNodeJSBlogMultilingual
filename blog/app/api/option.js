import { multilingualRequest, sourceRequest } from '~/api'

/**
 * @description 查询配置项
 * @return {any} 返回配置项
 */

const URL = `/options`
const getOptionsApi = (params = {}, options = {}) => {
  return sourceRequest.getFetch(URL, params, options)
}

const getMultilingualOptionsApi = (params = {}, options = {}) => {
  return multilingualRequest.getFetch(URL, params, options)
}

export { getOptionsApi, getMultilingualOptionsApi }
