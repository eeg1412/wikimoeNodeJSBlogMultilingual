import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/store/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { public: true }
  },
  {
    path: '/',
    component: () => import('@/views/Layout.vue'),
    redirect: '/dashboard',
    children: [
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue')
      },
      {
        path: 'import',
        name: 'Import',
        component: () => import('@/views/ImportPost.vue')
      },
      {
        path: 'post/group/list',
        name: 'PostGroupList',
        component: () => import('@/views/post/GroupList.vue')
      },
      {
        path: 'post/list',
        name: 'PostList',
        component: () => import('@/views/post/PostList.vue')
      },
      {
        path: 'post/edit/:id',
        name: 'PostEdit',
        component: () => import('@/views/post/PostEdit.vue')
      },
      {
        path: 'entity/:type/list',
        name: 'EntityList',
        component: () => import('@/views/entity/EntityList.vue')
      },
      {
        path: 'entity/:type/edit/:id',
        name: 'EntityEdit',
        component: () => import('@/views/entity/EntityEdit.vue')
      },
      {
        path: 'translation/memory',
        name: 'TranslationMemoryList',
        component: () => import('@/views/translation/MemoryList.vue')
      },
      {
        path: 'options',
        name: 'Options',
        component: () => import('@/views/Options.vue')
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/dashboard'
  }
]

const router = createRouter({
  // 与 server 静态托管和 Vite base 保持一致
  history: createWebHistory('/multilingual-admin/'),
  routes
})

router.beforeEach((to, from, next) => {
  const auth = useAuthStore()
  if (to.meta.public) return next()
  if (!auth.token) return next({ path: '/login', query: { r: to.fullPath } })
  next()
})

export default router
