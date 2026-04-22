import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as loginApi, getLoginUserInfo } from '../api/auth.js'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('admin_token') || '')
  const userInfo = ref(null)

  const isLoggedIn = computed(() => !!token.value)

  function setToken(newToken) {
    token.value = newToken
    localStorage.setItem('admin_token', newToken)
  }

  function clearToken() {
    token.value = ''
    userInfo.value = null
    localStorage.removeItem('admin_token')
  }

  async function login(username, password) {
    const res = await loginApi({ username, password })
    setToken(res.data.token)
    userInfo.value = res.data.userInfo
  }

  async function fetchUserInfo() {
    try {
      const res = await getLoginUserInfo()
      userInfo.value = res.data
    } catch {
      clearToken()
    }
  }

  function logout() {
    clearToken()
  }

  return { token, userInfo, isLoggedIn, login, logout, fetchUserInfo, setToken }
})
