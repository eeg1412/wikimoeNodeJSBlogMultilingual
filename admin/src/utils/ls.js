// localStorage wrapper with configurable prefix to avoid cross-app collisions
const PREFIX = import.meta.env.VITE_ADMIN_LS_PREFIX || 'ml_admin_'

function prefixedKey(key) {
  if (typeof key !== 'string') return key
  if (key.startsWith(PREFIX)) return key
  return PREFIX + key
}

export function getItem(key) {
  try {
    return localStorage.getItem(prefixedKey(key))
  } catch (e) {
    return localStorage.getItem(key)
  }
}

export function setItem(key, value) {
  try {
    return localStorage.setItem(prefixedKey(key), value)
  } catch (e) {
    return localStorage.setItem(key, value)
  }
}

export function removeItem(key) {
  try {
    return localStorage.removeItem(prefixedKey(key))
  } catch (e) {
    return localStorage.removeItem(key)
  }
}

export function clearPrefixed() {
  try {
    const toRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(PREFIX)) toRemove.push(k)
    }
    for (const k of toRemove) localStorage.removeItem(k)
  } catch (e) {
    // noop
  }
}

export default {
  getItem,
  setItem,
  removeItem,
  clearPrefixed,
  PREFIX
}
