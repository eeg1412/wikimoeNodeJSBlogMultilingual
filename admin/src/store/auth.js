import { defineStore } from 'pinia'

const TOKEN_KEY = 'ml_admin_token'
const ADMIN_KEY = 'ml_admin_user'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem(TOKEN_KEY) || '',
    admin: JSON.parse(localStorage.getItem(ADMIN_KEY) || 'null')
  }),
  actions: {
    set(token, admin) {
      this.token = token
      this.admin = admin
      localStorage.setItem(TOKEN_KEY, token)
      localStorage.setItem(ADMIN_KEY, JSON.stringify(admin))
    },
    clear() {
      this.token = ''
      this.admin = null
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(ADMIN_KEY)
    }
  }
})
