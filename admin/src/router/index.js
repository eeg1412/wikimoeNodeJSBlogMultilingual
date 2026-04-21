import { createRouter, createWebHistory } from 'vue-router'
import store from '@/store'
import { ENTITY_ROUTE_ORDER, ENTITY_META } from '@/constants/entities'

const entityRoutes = ENTITY_ROUTE_ORDER.map(entityType => ({
  path: `/${entityType}/list`,
  name: `${entityType}-list`,
  component: () => import('@/views/EntityListView.vue'),
  meta: {
    requiresAuth: true,
    entityType,
    title: ENTITY_META[entityType].title
  }
}))

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/LoginView.vue')
  },
  {
    path: '/',
    component: () => import('@/views/layout/AdminLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/import' },
      {
        path: '/import',
        name: 'Import',
        component: () => import('@/views/ImportView.vue'),
        meta: { title: '导入' }
      },
      {
        path: '/post/group/list',
        name: 'PostGroupList',
        component: () => import('@/views/PostGroupListView.vue'),
        meta: { title: '文章分组' }
      },
      {
        path: '/post/list',
        name: 'PostList',
        component: () => import('@/views/PostListView.vue'),
        meta: { title: '文章列表' }
      },
      {
        path: '/post/editor/:id',
        name: 'PostEditor',
        component: () => import('@/views/PostEditorView.vue'),
        meta: { title: '文章编辑' }
      },
      {
        path: '/option/list',
        name: 'OptionList',
        component: () => import('@/views/OptionListView.vue'),
        meta: { title: '站点配置' }
      },
      {
        path: '/aitranslationlog/list',
        name: 'TranslationLogList',
        component: () => import('@/views/TranslationLogListView.vue'),
        meta: { title: '翻译日志' }
      },
      ...entityRoutes
    ]
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach((to, from, next) => {
  if (to.meta.requiresAuth && !store.getters.isAuthenticated) {
    next({ name: 'Login' })
    return
  }
  if (to.name === 'Login' && store.getters.isAuthenticated) {
    next({ name: 'Import' })
    return
  }
  next()
})

export default router