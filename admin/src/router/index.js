import { createRouter, createWebHistory } from 'vue-router'
import {
  SOURCE_RELATION_ROUTE_NAME_MAP,
  TRANSLATION_RELATION_ROUTE_NAME_MAP
} from '../views/index/relation/relationCollection'

const getRelationRedirectQuery = query => {
  const redirectQuery = {}
  if (query.keyword) {
    redirectQuery.keyword = query.keyword
  }
  if (query.languageCode) {
    redirectQuery.languageCode = query.languageCode
  }

  return redirectQuery
}

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
        path: '/source/post/proper-noun',
        name: 'SourcePostProperNounList',
        component: () =>
          import('../views/index/source/SourcePostProperNounList.vue')
      },
      {
        path: '/source/config',
        name: 'SourceConfig',
        component: () => import('../views/index/source/SourceConfig.vue')
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
        component: () =>
          import('../views/index/relation/SourceRelationList.vue'),
        beforeEnter: to => {
          const routeName =
            SOURCE_RELATION_ROUTE_NAME_MAP[to.query.collectionName]
          if (!routeName) {
            return true
          }

          return {
            name: routeName,
            query: getRelationRedirectQuery(to.query)
          }
        }
      },
      {
        path: '/source/author/list',
        name: 'SourceAuthorRelationList',
        component: () =>
          import('../views/index/relation/SourceAuthorRelationList.vue')
      },
      {
        path: '/source/sort/list',
        name: 'SourceSortRelationList',
        component: () =>
          import('../views/index/relation/SourceSortRelationList.vue')
      },
      {
        path: '/source/tag/list',
        name: 'SourceTagRelationList',
        component: () =>
          import('../views/index/relation/SourceTagRelationList.vue')
      },
      {
        path: '/source/mappoint/list',
        name: 'SourceMappointRelationList',
        component: () =>
          import('../views/index/relation/SourceMappointRelationList.vue')
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
        path: '/translation/post/language-list/:sourceSnapshotId',
        name: 'TranslationPostLanguageList',
        component: () =>
          import('../views/index/translation/TranslationPostLanguageList.vue')
      },
      {
        path: '/translation/post/editor/:id',
        name: 'TranslationPostEdit',
        component: () =>
          import('../views/index/translation/TranslationPostEditor.vue')
      },
      {
        path: '/translation/job/list',
        name: 'TranslationJobList',
        component: () =>
          import('../views/index/translation/TranslationJobList.vue')
      },
      {
        path: '/translation/relation/list',
        name: 'RelationList',
        component: () =>
          import('../views/index/relation/TranslationRelationList.vue'),
        beforeEnter: to => {
          const routeName =
            TRANSLATION_RELATION_ROUTE_NAME_MAP[to.query.collectionName]
          if (!routeName) {
            return true
          }

          return {
            name: routeName,
            query: getRelationRedirectQuery(to.query)
          }
        }
      },
      {
        path: '/translation/author/list',
        name: 'TranslationAuthorRelationList',
        component: () =>
          import('../views/index/relation/TranslationAuthorRelationList.vue')
      },
      {
        path: '/translation/sort/list',
        name: 'TranslationSortRelationList',
        component: () =>
          import('../views/index/relation/TranslationSortRelationList.vue')
      },
      {
        path: '/translation/tag/list',
        name: 'TranslationTagRelationList',
        component: () =>
          import('../views/index/relation/TranslationTagRelationList.vue')
      },
      {
        path: '/translation/mappoint/list',
        name: 'TranslationMappointRelationList',
        component: () =>
          import('../views/index/relation/TranslationMappointRelationList.vue')
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
        path: '/settings/media',
        name: 'MultilingualMediaSettings',
        component: () =>
          import('../views/index/config/MultilingualMediaSettings.vue')
      },
      {
        path: '/settings/ai',
        name: 'MultilingualAiSettings',
        component: () =>
          import('../views/index/config/MultilingualAiSettings.vue')
      },
      {
        path: '/ai/usage/summary',
        name: 'AiUsageSummary',
        component: () => import('../views/index/ai/AiUsageSummary.vue')
      },
      {
        path: '/translation/proper-noun/list',
        name: 'ProperNounTranslationList',
        component: () =>
          import('../views/index/properNoun/ProperNounTranslationList.vue')
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
