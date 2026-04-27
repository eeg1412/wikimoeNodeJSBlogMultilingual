import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'Index',
    redirect: '/dashboard/multilingual',
    component: () => import('../views/index/Index.vue'),
    children: [
      {
        path: '/dashboard/multilingual',
        name: 'MultilingualDashboard',
        component: () =>
          import('../views/index/dashboard/MultilingualDashboard.vue')
      },
      {
        path: '/source/post/import',
        name: 'SourcePostImport',
        component: () => import('../views/index/source/SourcePostImport.vue')
      },
      {
        path: '/source/post/snapshot/list',
        name: 'SourcePostSnapshotList',
        component: () =>
          import('../views/index/source/SourcePostSnapshotList.vue')
      },
      {
        path: '/source/relation/list',
        name: 'SourceRelationList',
        component: () => import('../views/index/relation/RelationList.vue'),
        meta: { scope: 'source' }
      },
      {
        path: '/source/media/snapshot/list',
        name: 'SourceMediaSnapshotList',
        component: () =>
          import('../views/index/media/MultilingualMediaList.vue'),
        meta: { scope: 'source' }
      },
      {
        path: '/translation/post/list',
        name: 'TranslationPostList',
        component: () =>
          import('../views/index/translation/TranslationPostList.vue')
      },
      {
        path: '/translation/post/editor/:id',
        name: 'TranslationPostEdit',
        component: () =>
          import('../views/index/translation/TranslationPostEditor.vue')
      },
      {
        path: '/translation/relation/list',
        name: 'RelationList',
        component: () => import('../views/index/relation/RelationList.vue'),
        meta: { scope: 'translation' }
      },
      {
        path: '/translation/media/list',
        name: 'MultilingualMediaList',
        component: () =>
          import('../views/index/media/MultilingualMediaList.vue'),
        meta: { scope: 'translation' }
      },
      {
        path: '/settings/multilingual',
        name: 'MultilingualConfig',
        component: () => import('../views/index/config/MultilingualConfig.vue')
      },
      {
        path: '/home',
        name: 'Home',
        redirect: '/dashboard/multilingual'
      },
      {
        path: '/loginuser/editor',
        name: 'LoginUserEditor',
        component: () => import('../views/index/loginuser/LoginUserEditor.vue')
      },
      {
        path: '/navi/list',
        name: 'NaviList',
        component: () => import('../views/index/navi/NaviList.vue')
      },
      {
        path: '/navi/add',
        name: 'NaviAdd',
        component: () => import('../views/index/navi/NaviEditor.vue')
      },
      {
        path: '/navi/editor/:id',
        name: 'NaviEdit',
        component: () => import('../views/index/navi/NaviEditor.vue')
      },
      {
        path: '/sidebar/list',
        name: 'SidebarList',
        component: () => import('../views/index/sidebar/SidebarList.vue')
      },
      {
        path: '/banner/list',
        name: 'BannerList',
        component: () => import('../views/index/banner/BannerList.vue')
      },
      {
        path: '/readerlog/list',
        name: 'ReaderlogList',
        component: () => import('../views/index/readerlog/ReaderlogList.vue')
      },
      {
        path: '/referrer/list',
        name: 'ReferrerList',
        component: () => import('../views/index/referrer/ReferrerList.vue')
      },
      {
        path: '/backup/list',
        name: 'BackupList',
        component: () => import('../views/index/backup/BackupList.vue')
      }
    ]
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/Login.vue')
  }
]

const router = createRouter({
  history: createWebHistory('/multilingual-admin'),
  routes
})

export default router
