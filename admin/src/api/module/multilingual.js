export default function (api) {
  return {
    getDashboardSummary(data, noLoading = false) {
      return api.get('/dashboard/summary', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    importSourcePost(data) {
      return api.post('/source/post/import', data, {
        shouldAdminJWT: true
      })
    },
    overwriteSourcePost(data) {
      return api.post('/source/post/overwrite', data, {
        shouldAdminJWT: true
      })
    },
    getSourceDatabasePostList(data, noLoading = false) {
      return api.get('/source/post/source-list', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    getSourcePostList(data, noLoading = false) {
      return api.get('/source/post/list', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    getSourceRelationList(data, noLoading = false) {
      return api.get('/source/relation/list', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    getSourcePostDetail(data) {
      return api.get('/source/post/detail', {
        params: data,
        shouldAdminJWT: true
      })
    },
    getLanguageSettings(data, noLoading = false) {
      return api.get('/settings/language/list', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    updateLanguageSettings(data) {
      return api.put('/settings/language/update', data, {
        shouldAdminJWT: true
      })
    },
    getMediaSettings(data = {}, noLoading = false) {
      return api.get('/settings/media/get', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    updateMediaSettings(data) {
      return api.put('/settings/media/update', data, {
        shouldAdminJWT: true
      })
    },
    getAiSettings(data = {}, noLoading = false) {
      return api.get('/settings/ai/get', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    updateAiSettings(data) {
      return api.put('/settings/ai/update', data, {
        shouldAdminJWT: true
      })
    },
    getAiUsageSummary(data = {}, noLoading = false) {
      return api.get('/ai/usage/summary', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    createTranslationPost(data) {
      return api.post('/translation/post/create', data, {
        shouldAdminJWT: true
      })
    },
    createMissingPostRelationTranslation(data) {
      return api.post('/translation/post/create-relation-translation', data, {
        shouldAdminJWT: true
      })
    },
    getTranslationPostListBySource(data, noLoading = false) {
      return api.get('/translation/post/list-by-source', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    getTranslationPostDetail(data) {
      return api.get('/translation/post/detail', {
        params: data,
        shouldAdminJWT: true
      })
    },
    updateTranslationPost(data) {
      return api.put('/translation/post/update', data, {
        shouldAdminJWT: true
      })
    },
    restoreTranslationPostSnapshot(data) {
      return api.post('/translation/post/restore-snapshot', data, {
        shouldAdminJWT: true
      })
    },
    updateTranslationRelation(data) {
      return api.put('/translation/relation/update', data, {
        shouldAdminJWT: true
      })
    },
    restoreTranslationRelationSnapshot(data) {
      return api.post('/translation/relation/restore-snapshot', data, {
        shouldAdminJWT: true
      })
    },
    getTranslationRelationList(data, noLoading = false) {
      return api.get('/translation/relation/list', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    getMediaList(data, noLoading = false) {
      return api.get('/media/list', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    replaceLocalMedia(data) {
      return api.post('/media/replace-local', data, {
        shouldAdminJWT: true
      })
    },
    convertRemoteMedia(data) {
      return api.post('/media/convert-remote', data, {
        shouldAdminJWT: true
      })
    },
    restoreMediaSnapshot(data) {
      return api.post('/media/restore-snapshot', data, {
        shouldAdminJWT: true
      })
    }
  }
}
