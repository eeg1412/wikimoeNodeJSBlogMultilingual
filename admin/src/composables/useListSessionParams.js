import { getSessionParams, setSessionParams } from '@/utils/utils'

export function restoreListSessionParams(
  route,
  params,
  queryParamKeys = [],
  sessionKey = route.name
) {
  const sessionParams = getSessionParams(sessionKey)
  if (sessionParams) {
    Object.keys(params).forEach(key => {
      if (Object.prototype.hasOwnProperty.call(sessionParams, key)) {
        params[key] = sessionParams[key]
      }
    })
  }

  let hasQueryParamChanged = false
  queryParamKeys.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(route.query, key)) {
      if (params[key] !== route.query[key]) {
        hasQueryParamChanged = true
      }
      params[key] = route.query[key]
    }
  })
  if (
    hasQueryParamChanged &&
    Object.prototype.hasOwnProperty.call(params, 'page')
  ) {
    params.page = 1
  }
}

export function saveListSessionParams(route, params, sessionKey = route.name) {
  setSessionParams(sessionKey, { ...params })
}
