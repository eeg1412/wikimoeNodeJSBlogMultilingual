import { createStore } from 'vuex'

function readJSON(key, fallback) {
  const rawValue = localStorage.getItem(key)
  if (!rawValue) {
    return fallback
  }
  try {
    return JSON.parse(rawValue)
  } catch (error) {
    return fallback
  }
}

const store = createStore({
  state() {
    return {
      adminInfo: readJSON('adminInfo', null),
      adminToken: localStorage.getItem('adminToken') || '',
      loadingShow: false,
      siteUrl: ''
    }
  },
  getters: {
    adminToken(state) {
      return state.adminToken
    },
    isAuthenticated(state) {
      return Boolean(state.adminToken)
    }
  },
  mutations: {
    clearAuth(state) {
      state.adminToken = ''
      state.adminInfo = null
      localStorage.removeItem('adminToken')
      localStorage.removeItem('adminInfo')
    },
    setAdminAuth(state, payload) {
      state.adminToken = payload.token
      state.adminInfo = payload.admin
      localStorage.setItem('adminToken', payload.token)
      localStorage.setItem('adminInfo', JSON.stringify(payload.admin))
    },
    setLoading(state, value) {
      state.loadingShow = value
    },
    setSiteUrl(state, value) {
      state.siteUrl = value
    }
  }
})

export default store