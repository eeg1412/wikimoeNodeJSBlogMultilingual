import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '../store/auth.js'

const routes = [
  {
    path: '/multilingual-admin/login',
    name: 'Login',
    component: () => import('../views/Login.vue'),
    meta: { public: true }
  },
  {
    path: '/multilingual-admin',
    component: () => import('../layouts/AdminLayout.vue'),
    redirect: '/multilingual-admin/import',
    children: [
      {
        path: 'import',
        name: 'Import',
        component: () => import('../views/Import.vue')
      },
      {
        path: 'import/jobs',
        name: 'ImportJobs',
        component: () => import('../views/ImportJobList.vue')
      },
      {
        path: 'posts',
        name: 'PostGroupList',
        component: () => import('../views/PostGroupList.vue')
      },
      {
        path: 'posts/edit/:id',
        name: 'PostEditor',
        component: () => import('../views/PostEditor.vue')
      },
      {
        path: 'authors',
        name: 'AuthorList',
        component: () => import('../views/AuthorList.vue')
      },
      {
        path: 'sorts',
        name: 'SortList',
        component: () => import('../views/SortList.vue')
      },
      {
        path: 'tags',
        name: 'TagList',
        component: () => import('../views/TagList.vue')
      },
      {
        path: 'mappoints',
        name: 'MappointList',
        component: () => import('../views/MappointList.vue')
      },
      {
        path: 'attachments',
        name: 'AttachmentList',
        component: () => import('../views/AttachmentList.vue')
      },
      {
        path: 'bangumi',
        name: 'BangumiList',
        component: () => import('../views/entity/BangumiList.vue')
      },
      {
        path: 'movies',
        name: 'MovieList',
        component: () => import('../views/entity/MovieList.vue')
      },
      {
        path: 'games',
        name: 'GameList',
        component: () => import('../views/entity/GameList.vue')
      },
      {
        path: 'books',
        name: 'BookList',
        component: () => import('../views/entity/BookList.vue')
      },
      {
        path: 'events',
        name: 'EventList',
        component: () => import('../views/entity/EventList.vue')
      },
      {
        path: 'votes',
        name: 'VoteList',
        component: () => import('../views/VoteList.vue')
      },
      {
        path: 'translation-memory',
        name: 'TranslationMemory',
        component: () => import('../views/TranslationMemory.vue')
      },
      {
        path: 'ai-translation-log',
        name: 'AiTranslationLog',
        component: () => import('../views/AiTranslationLog.vue')
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('../views/Settings.vue')
      },
      {
        path: 'login-log',
        name: 'LoginLog',
        component: () => import('../views/LoginLog.vue')
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/multilingual-admin'
  }
]

const router = createRouter({
  history: createWebHistory('/'),
  routes
})

router.beforeEach(async to => {
  const authStore = useAuthStore()
  if (to.meta.public) return true
  if (!authStore.isLoggedIn) {
    return {
      path: '/multilingual-admin/login',
      query: { redirect: to.fullPath }
    }
  }
  return true
})

export default router
