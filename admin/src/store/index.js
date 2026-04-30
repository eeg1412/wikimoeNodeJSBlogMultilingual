import { createStore } from 'vuex'
import { authApi } from '@/api'
import ls from '@/utils/ls'

const DEFAULT_BLOG_LANGUAGE_CODE = 'zh-CN'

function getDefaultBlogUrl() {
  if (typeof window === 'undefined') {
    return `/${DEFAULT_BLOG_LANGUAGE_CODE}/`
  }

  return `${window.location.origin}/${DEFAULT_BLOG_LANGUAGE_CODE}/`
}

export default createStore({
  state: {
    adminToken: ls.getItem('adminToken') || '',
    adminInfo: null,
    loadingShow: false,
    siteUrl: getDefaultBlogUrl()
  },
  getters: {
    adminToken: state => state.adminToken,
    loadingShow: state => state.loadingShow,
    // getAdminInfo
    adminInfo: state => state.adminInfo,
    siteUrl: state => state.siteUrl
  },
  mutations: {
    setLoading(state, data) {
      state.loadingShow = data
    },

    setAdminToken(state, data) {
      state.adminToken = data
    },
    // setAdminInfo
    setAdminInfo(state, adminInfo) {
      authApi
        .loginuserinfo()
        .then(res => {
          state.adminInfo = res.data.data
        })
        .catch(() => {
          state.adminInfo = null
        })
    },
    setOptions(state) {
      state.siteUrl = getDefaultBlogUrl()
    }
  },
  actions: {
    setLoading({ commit }, data) {
      commit('setLoading', data)
    },

    setAdminToken({ commit }, data) {
      ls.setItem('adminToken', data)
      commit('setAdminToken', data)
    },

    // setAdminInfo
    setAdminInfo({ commit }) {
      commit('setAdminInfo')
    },
    setOptions({ commit }) {
      commit('setOptions')
    }
  }
})
