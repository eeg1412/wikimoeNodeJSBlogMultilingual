import { createRouter, createWebHistory } from 'vue-router'

import ImportView from '@/views/ImportView.vue'
import LoginView from '@/views/LoginView.vue'
import PostEditorView from '@/views/PostEditorView.vue'
import PostListView from '@/views/post/PostListView.vue'
import AdminLoginLogView from '@/views/security/AdminLoginLogView.vue'
import SettingsView from '@/views/settings/SettingsView.vue'

import { getAdminToken } from '@/utils/adminSession'

const routes = [
  {
    path: '/',
    redirect: function () {
      if (getAdminToken()) {
        return { name: 'Import' }
      }

      return { name: 'Login' }
    }
  },
  {
    path: '/login',
    name: 'Login',
    component: LoginView,
    meta: {
      guestOnly: true
    }
  },
  {
    path: '/import',
    name: 'Import',
    component: ImportView,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: SettingsView,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/posts',
    name: 'PostList',
    component: PostListView,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/security/login-logs',
    name: 'AdminLoginLog',
    component: AdminLoginLogView,
    meta: {
      requiresAuth: true
    }
  },
  {
    path: '/post/editor/:id',
    name: 'PostEditor',
    component: PostEditorView,
    meta: {
      requiresAuth: true
    }
  }
]

const router = createRouter({
  history: createWebHistory('/multilingual-admin/'),
  routes
})

router.beforeEach(function (to) {
  const hasToken = Boolean(getAdminToken())

  if (to.meta.requiresAuth && !hasToken) {
    return { name: 'Login' }
  }

  if (to.meta.guestOnly && hasToken) {
    return { name: 'Import' }
  }

  return true
})

export default router
