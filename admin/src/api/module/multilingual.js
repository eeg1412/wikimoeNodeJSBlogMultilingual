export default function (api) {
  return {
    getDashboardSummary(data, noLoading = false) {
      return api.get('/dashboard/summary', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    importSourcePost(data, noLoading = false) {
      return api.post('/source/post/import', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    applySourcePostAiImport(data, noLoading = false) {
      return api.post('/source/post/apply-ai-import', data, {
        shouldAdminJWT: true,
        noLoading
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
    getSourceDatabasePostDetail(data, noLoading = false) {
      return api.get('/source/post/source-detail', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    getSourcePostAiImportPreviewContext(data, noLoading = false) {
      return api.get('/source/post/ai-import-preview-context', {
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
    syncSourceAuthorMedia(data, noLoading = false) {
      return api.post('/source/relation/sync-author-media', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    getSourcePostDetail(data, noLoading = false) {
      return api.get('/source/post/detail', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    getSourceConfig(data = {}, noLoading = false) {
      return api.get('/source/config/get', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    refreshSourceConfig(data = {}, noLoading = false) {
      return api.post('/source/config/refresh', data, {
        shouldAdminJWT: true,
        noLoading
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
    getProperNounTermList(data = {}, noLoading = false) {
      return api.get('/proper-noun/term/list', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    getProperNounTermDetail(data = {}, noLoading = false) {
      return api.get('/proper-noun/term/detail', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    createProperNounTerm(data, noLoading = false) {
      return api.post('/proper-noun/term/create', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    updateProperNounTerm(data, noLoading = false) {
      return api.put('/proper-noun/term/update', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    updateProperNounTermStar(data, noLoading = false) {
      return api.put('/proper-noun/term/star', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    deleteProperNounTerm(data, noLoading = false) {
      return api.delete('/proper-noun/term/delete', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    batchDeleteProperNounTerms(data, noLoading = false) {
      return api.post('/proper-noun/term/batch-delete', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    getProperNounTranslationList(data = {}, noLoading = false) {
      return api.get('/proper-noun/translation/list', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    createProperNounTranslation(data, noLoading = false) {
      return api.post('/proper-noun/translation/create', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    updateProperNounTranslation(data, noLoading = false) {
      return api.put('/proper-noun/translation/update', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    deleteProperNounTranslation(data, noLoading = false) {
      return api.delete('/proper-noun/translation/delete', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    searchProperNounInternetTranslations(data, noLoading = false) {
      return api.post('/proper-noun/internet-search', data, {
        shouldAdminJWT: true,
        noLoading,
        timeout: 130000
      })
    },
    applyProperNounInternetTranslations(data, noLoading = false) {
      return api.post('/proper-noun/internet-search/apply', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    getSourcePostProperNounTermList(data = {}, noLoading = false) {
      return api.get('/source/post/proper-noun/list', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    createSourcePostProperNounTerm(data, noLoading = false) {
      return api.post('/source/post/proper-noun/create', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    batchBindSourcePostProperNounTerms(data, noLoading = false) {
      return api.post('/source/post/proper-noun/batch-bind', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    unbindSourcePostProperNounTerm(data, noLoading = false) {
      return api.delete('/source/post/proper-noun/unbind', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    createSourcePostProperNounOrganizeJob(data, noLoading = false) {
      return api.post('/source/post/proper-noun/organize-job', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    createTranslationJob(data, noLoading = false) {
      return api.post('/translation/job/create', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    getTranslationJobList(data, noLoading = false) {
      return api.get('/translation/job/list', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    getTranslationJobStorageSummary(data = {}, noLoading = false) {
      return api.get('/translation/job/storage', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    getTranslationJobDetail(data, noLoading = false) {
      return api.get('/translation/job/detail', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    getTranslationJobFamily(data, noLoading = false) {
      return api.get('/translation/job/family', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    getSourcePostRelatedScope(data, noLoading = false) {
      return api.get('/translation/post/related-scope', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    deferTranslationJob(data, noLoading = false) {
      return api.put('/translation/job/defer', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    resumeTranslationJob(data, noLoading = false) {
      return api.put('/translation/job/resume', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    stopTranslationJob(data, noLoading = false) {
      return api.post('/translation/job/stop', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    deleteTranslationJob(data, noLoading = false) {
      return api.delete('/translation/job/delete', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    batchDeleteTranslationJobs(data, noLoading = false) {
      return api.post('/translation/job/batch-delete', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    rejectTranslationJob(data, noLoading = false) {
      return api.post('/translation/job/reject', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    retryTranslationJob(data, noLoading = false) {
      return api.post('/translation/job/retry', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    applyTranslationJobResult(data, noLoading = false) {
      return api.post('/translation/job/apply', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    applyTranslationFamilyResult(data, noLoading = false) {
      return api.post('/translation/job/apply-family', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    adoptTranslationJobCoverImage(data, noLoading = false) {
      return api.post('/translation/job/cover-image/adopt', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    adoptTranslationPreviewCoverImage(data, noLoading = false) {
      return api.post('/translation/post/ai-cover-image/adopt', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    cleanupTranslationJobCoverImages(data, noLoading = false) {
      return api.post('/translation/job/cover-image/cleanup', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    createTranslationPost(data, noLoading = false) {
      return api.post('/translation/post/create', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    createMissingPostRelationTranslation(data, noLoading = false) {
      return api.post('/translation/post/create-relation-translation', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    getTranslationPostListBySource(data, noLoading = false) {
      return api.get('/translation/post/list-by-source', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    getTranslationPostDetail(data, noLoading = false) {
      return api.get('/translation/post/detail', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    updateTranslationAiSkip(data, noLoading = false) {
      return api.put('/translation/ai/skip', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    updateTranslationPost(data, noLoading = false) {
      return api.put('/translation/post/update', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    getTranslationPostSourceLinkPreview(data, noLoading = false) {
      return api.post('/translation/post/source-link/preview', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    applyTranslationPostSourceLinkReplacement(data, noLoading = false) {
      return api.post('/translation/post/source-link/apply', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    updateTranslationPostStatus(data, noLoading = false) {
      return api.put('/translation/post/status', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    restoreTranslationPostSnapshot(data) {
      return api.post('/translation/post/restore-snapshot', data, {
        shouldAdminJWT: true
      })
    },
    getTranslationPostSnapshotRestorePreview(data, noLoading = false) {
      return api.post('/translation/post/restore-snapshot/preview', data, {
        shouldAdminJWT: true,
        noLoading
      })
    },
    updateTranslationRelation(data, noLoading = false) {
      return api.put('/translation/relation/update', data, {
        shouldAdminJWT: true,
        noLoading
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
    getTranslationRelationListBySource(data, noLoading = false) {
      return api.get('/translation/relation/list-by-source', {
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
    getMediaListBySource(data, noLoading = false) {
      return api.get('/media/list-by-source', {
        params: data,
        shouldAdminJWT: true,
        noLoading
      })
    },
    createLocalMedia(data) {
      return api.post('/media/create-local', data, {
        shouldAdminJWT: true
      })
    },
    deleteLocalMedia(data) {
      return api.delete('/media/delete-local', {
        params: data,
        shouldAdminJWT: true
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
