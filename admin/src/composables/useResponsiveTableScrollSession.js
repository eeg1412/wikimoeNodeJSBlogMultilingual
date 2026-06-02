import { ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { getSessionParams, setSessionParams } from '@/utils/utils'

function getScrollSessionKey(route, sessionKey) {
  if (typeof sessionKey === 'function') {
    return sessionKey(route)
  }
  if (sessionKey) {
    return sessionKey
  }
  return `${route.name}:responsive-table-scroll`
}

function isValidScrollPosition(position) {
  if (!position || typeof position !== 'object') {
    return false
  }
  return Number.isFinite(Number(position.top))
}

function normalizeScrollPosition(position) {
  const normalized = {
    top: Number(position.top),
    left: 0
  }
  if (Number.isFinite(Number(position.left))) {
    normalized.left = Number(position.left)
  }
  return normalized
}

export function useResponsiveTableScrollSession(route, tableRef, options = {}) {
  const restored = ref(false)

  const getSessionKey = () => {
    return getScrollSessionKey(route, options.sessionKey)
  }

  const saveTableScrollPosition = () => {
    const position = tableRef.value?.getScrollPosition?.()
    if (!isValidScrollPosition(position)) {
      return
    }
    setSessionParams(getSessionKey(), normalizeScrollPosition(position))
  }

  const restoreTableScrollOnNextDataRefresh = () => {
    if (restored.value) {
      return
    }
    restored.value = true

    const position = getSessionParams(getSessionKey())
    if (!isValidScrollPosition(position)) {
      return
    }
    tableRef.value?.preserveScrollOnNextDataRefresh?.(
      normalizeScrollPosition(position)
    )
  }

  onBeforeRouteLeave(() => {
    saveTableScrollPosition()
  })

  return {
    saveTableScrollPosition,
    restoreTableScrollOnNextDataRefresh
  }
}
