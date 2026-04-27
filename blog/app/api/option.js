import { multilingualRequest, sourceRequest } from '~/api'

/**
 * @description 查询配置项
 * @return {any} 返回配置项
 */

const URL = `/options`
const getOptionsApi = () => {
  return sourceRequest.getFetch(URL)
}

const getMultilingualOptionsApi = () => {
  return multilingualRequest.getFetch(URL)
}

export { getOptionsApi, getMultilingualOptionsApi }
