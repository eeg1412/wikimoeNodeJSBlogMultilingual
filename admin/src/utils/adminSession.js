const TOKEN_STORAGE_KEY = 'multilingualAdminToken'
const REMEMBER_STORAGE_KEY = 'multilingualAdminRemember'

function getStorage(remember) {
  if (remember) {
    return localStorage
  }

  return sessionStorage
}

function getRememberMode() {
  const localRemember = localStorage.getItem(REMEMBER_STORAGE_KEY)
  const sessionRemember = sessionStorage.getItem(REMEMBER_STORAGE_KEY)

  if (localRemember === '1') {
    return true
  }

  if (sessionRemember === '1') {
    return false
  }

  return null
}

function getAdminToken() {
  const localToken = localStorage.getItem(TOKEN_STORAGE_KEY)
  if (localToken) {
    return localToken
  }

  return sessionStorage.getItem(TOKEN_STORAGE_KEY)
}

function setAdminToken(token, remember) {
  clearAdminToken()
  const storage = getStorage(remember)
  storage.setItem(TOKEN_STORAGE_KEY, token)
  storage.setItem(REMEMBER_STORAGE_KEY, remember ? '1' : '0')
}

function clearAdminToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
  sessionStorage.removeItem(TOKEN_STORAGE_KEY)
  localStorage.removeItem(REMEMBER_STORAGE_KEY)
  sessionStorage.removeItem(REMEMBER_STORAGE_KEY)
}

export { clearAdminToken, getAdminToken, getRememberMode, setAdminToken }
