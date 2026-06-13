<template>
  <div class="common-right-panel-form translation-post-language-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item :to="{ name: 'TranslationPostList' }">
          多语言文章
        </el-breadcrumb-item>
        <el-breadcrumb-item>语言版本</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <el-skeleton v-if="loading" :rows="8" animated />
    <template v-else-if="sourcePost">
      <el-descriptions class="mb20" :column="2" border>
        <el-descriptions-item label="源文章">
          {{ getPostDisplayTitle(sourcePost) }}
        </el-descriptions-item>
        <el-descriptions-item label="源语言">
          {{ getLanguageText(sourcePost.sourceLanguageCode) }}
        </el-descriptions-item>
        <el-descriptions-item label="源 ID">
          {{ sourcePost.sourceId || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="快照版本">
          v{{ sourcePost.snapshotVersion || 1 }}
        </el-descriptions-item>
      </el-descriptions>

      <div class="mb20 translation-language-toolbar">
        <el-button
          type="primary"
          :disabled="selectedTranslationRows.length === 0"
          @click="openBatchAiTranslationDialog"
        >
          批量 AI 翻译{{
            selectedTranslationRows.length > 0
              ? `（${selectedTranslationRows.length}）`
              : ''
          }}
        </el-button>
        <span class="translation-language-toolbar-hint">
          勾选已创建的语言版本后，可一次性对多个语言版本批量发起 AI 翻译。
        </span>
      </div>

      <div class="mb20 list-table-body">
        <ResponsiveTable
          ref="tableRef"
          :data="translationRows"
          row-key="languageCode"
          border
          @selection-change="handleSelectionChange"
        >
          <ResponsiveTableColumn
            type="selection"
            width="50"
            :selectable="isRowSelectable"
          />
          <ResponsiveTableColumn label="语言" width="150">
            <template #default="{ row }">
              {{ getLanguageText(row.languageCode) }}
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn label="标题" min-width="220">
            <template #default="{ row }">
              <span v-if="row.translation">
                <div class="source-title">
                  {{ getPostDisplayTitle(row.translation) }}
                </div>
                <div v-if="row.translation.alias" class="source-meta">
                  别名：{{ row.translation.alias }}
                </div>
              </span>
              <el-tag v-else type="info" effect="plain">未创建</el-tag>
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn label="分类" min-width="140">
            <template #default="{ row }">
              <span v-if="row.translation">
                {{ row.translation.sort?.sortname || '-' }}
              </span>
              <span v-else class="table-empty-text">-</span>
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn label="标签" min-width="220">
            <template #default="{ row }">
              <div v-if="row.translation?.tags?.length" class="table-tag-list">
                <el-tag
                  v-for="tag in row.translation.tags"
                  :key="tag._id"
                  size="small"
                  effect="plain"
                >
                  #{{ tag.tagname }}
                </el-tag>
              </div>
              <span v-else class="table-empty-text">-</span>
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn label="地点" min-width="220">
            <template #default="{ row }">
              <div
                v-if="row.translation?.mappointList?.length"
                class="table-tag-list"
              >
                <el-tag
                  v-for="mappoint in row.translation.mappointList"
                  :key="mappoint._id"
                  size="small"
                  effect="plain"
                >
                  {{ mappoint.title }}
                </el-tag>
              </div>
              <span v-else class="table-empty-text">-</span>
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn label="关联与相关内容" min-width="420">
            <template #default="{ row }">
              <PostRelationSummary
                v-if="row.translation"
                :post="row.translation"
              />
              <span v-else class="table-empty-text">-</span>
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn label="状态" width="150">
            <template #default="{ row }">
              <div v-if="row.translation" class="translation-status-cell">
                <el-switch
                  :model-value="isTranslationPublished(row.translation)"
                  :loading="isStatusUpdating(row.translation)"
                  :disabled="isStatusSwitchDisabled(row.translation)"
                  @change="
                    value => updateTranslationStatus(row.translation, value)
                  "
                />
                <el-tag
                  v-if="isStatusSwitchDisabled(row.translation)"
                  type="danger"
                  size="small"
                  effect="plain"
                >
                  {{ getPostStatusText(row.translation.status) }}
                </el-tag>
              </div>
              <span v-else class="table-empty-text">-</span>
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn label="版本" width="90">
            <template #default="{ row }">
              <span v-if="row.translation">
                v{{ row.translation.snapshotVersion }}
              </span>
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn label="复核" width="110">
            <template #default="{ row }">
              <el-tag
                v-if="row.translation?.pendingReview"
                type="warning"
                effect="plain"
              >
                待复核
              </el-tag>
              <el-tag v-else-if="row.translation" type="success" effect="plain">
                正常
              </el-tag>
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn label="AI翻译跳过" width="130">
            <template #default="{ row }">
              <el-switch
                v-if="row.translation"
                :model-value="row.translation.aiTranslationSkip === true"
                :loading="isAiSkipUpdating(row.translation)"
                @change="value => updateAiSkip(row.translation, value)"
              />
              <span v-else class="table-empty-text">-</span>
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn label="更新时间" width="180">
            <template #default="{ row }">
              <span v-if="row.translation">
                {{ $formatDate(row.translation.updatedAt) }}
              </span>
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn label="操作" width="460" fixed="right">
            <template #default="{ row }">
              <div class="translation-row-actions">
                <el-button
                  v-if="row.translation"
                  type="primary"
                  size="small"
                  @click="goTranslationEditor(row.translation)"
                >
                  编辑
                </el-button>
                <TranslationPostAiTranslateButton
                  v-if="row.translation"
                  :post="row.translation"
                  size="small"
                  @translate="openAiTranslationDialog"
                />
                <el-button
                  v-if="row.translation"
                  type="warning"
                  size="small"
                  @click="openRestoreTranslationDialog(row.translation)"
                >
                  同步快照
                </el-button>
                <el-button
                  v-if="row.translation"
                  type="warning"
                  size="small"
                  @click="openSourceLinkRewriteDialog(row.translation)"
                >
                  检查源站链接
                </el-button>
                <el-button
                  v-else
                  type="primary"
                  size="small"
                  :loading="
                    rowActionLoadingMap[getCreateActionKey(row.languageCode)]
                  "
                  :disabled="
                    rowActionLoadingMap[getCreateActionKey(row.languageCode)]
                  "
                  @click="createTranslation(row.languageCode)"
                >
                  创建
                </el-button>
              </div>
            </template>
          </ResponsiveTableColumn>
        </ResponsiveTable>
      </div>
    </template>
    <el-empty v-else description="源文章快照不存在" />

    <TranslationPostAiTranslationDialog
      v-model="aiTranslationDialogVisible"
      :post-id="aiTranslationPostId"
      @saved="handleAiTranslationSaved"
    />
    <TranslationPostBatchAiTranslationDialog
      v-model="batchAiTranslationDialogVisible"
      :source-post="sourcePost"
      :source-snapshot-id="route.params.sourceSnapshotId"
      :targets="batchAiTranslationTargets"
      @submitted="handleBatchAiTranslationSubmitted"
    />
    <TranslationPostSnapshotRestoreDialog
      v-model="snapshotRestoreDialogVisible"
      :post-id="snapshotRestorePost?._id || ''"
      :source-snapshot-id="route.params.sourceSnapshotId"
      :language-code="snapshotRestorePost?.languageCode || ''"
      @restored="handleSnapshotRestored"
    />
    <TranslationPostSourceLinkRewriteDialog
      v-model="sourceLinkRewriteDialogVisible"
      :post-id="sourceLinkRewritePost?._id || ''"
      :language-code="sourceLinkRewritePost?.languageCode || ''"
      @applied="handleSourceLinkRewriteApplied"
    />
  </div>
</template>

<script>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { multilingualApi } from '@/api'
import PostRelationSummary from '@/components/PostRelationSummary.vue'
import TranslationPostAiTranslateButton from '@/components/TranslationPostAiTranslateButton.vue'
import TranslationPostAiTranslationDialog from '@/components/TranslationPostAiTranslationDialog.vue'
import TranslationPostBatchAiTranslationDialog from '@/components/TranslationPostBatchAiTranslationDialog.vue'
import TranslationPostSnapshotRestoreDialog from '@/components/TranslationPostSnapshotRestoreDialog.vue'
import TranslationPostSourceLinkRewriteDialog from '@/components/TranslationPostSourceLinkRewriteDialog.vue'
import {
  SUPPORTED_LANGUAGE_OPTIONS,
  getLanguageText,
  getPostDisplayTitle,
  getPostStatusText
} from '@/utils/multilingual'

export default {
  name: 'TranslationPostLanguageList',
  components: {
    PostRelationSummary,
    TranslationPostAiTranslateButton,
    TranslationPostAiTranslationDialog,
    TranslationPostBatchAiTranslationDialog,
    TranslationPostSnapshotRestoreDialog,
    TranslationPostSourceLinkRewriteDialog
  },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const tableRef = ref(null)
    const loading = ref(false)
    const sourceGroup = ref(null)
    const aiTranslationDialogVisible = ref(false)
    const aiTranslationPostId = ref('')
    const batchAiTranslationDialogVisible = ref(false)
    const selectedTranslationRows = ref([])
    const snapshotRestoreDialogVisible = ref(false)
    const snapshotRestorePost = ref(null)
    const sourceLinkRewriteDialogVisible = ref(false)
    const sourceLinkRewritePost = ref(null)
    const rowActionLoadingMap = reactive({})

    const sourcePost = computed(() => {
      return sourceGroup.value?.sourcePost || null
    })

    /**
     * 获取当前源文章可创建或查看的目标语言选项。
     * 源文章自身语言只作为来源信息展示，不作为翻译版本行出现。
     * @returns {Array<{ label: string, value: string }>} 目标语言选项列表
     */
    const targetLanguageOptions = computed(() => {
      const sourceLanguageCode = sourcePost.value?.sourceLanguageCode
      return SUPPORTED_LANGUAGE_OPTIONS.filter(item => {
        return item.value !== sourceLanguageCode
      })
    })

    const translationRows = computed(() => {
      const translations = sourceGroup.value?.translations || {}
      return targetLanguageOptions.value.map(item => {
        return {
          languageCode: item.value,
          translation: translations[item.value]
        }
      })
    })

    function setRowLoading(id, value) {
      rowActionLoadingMap[id] = value
    }

    function getCreateActionKey(languageCode) {
      return `create:${languageCode}`
    }

    function getAiSkipActionKey(translation) {
      if (!translation || !translation._id) {
        return ''
      }
      return `aiSkip:${translation._id}`
    }

    function isAiSkipUpdating(translation) {
      const actionKey = getAiSkipActionKey(translation)
      if (!actionKey) {
        return false
      }
      return rowActionLoadingMap[actionKey] === true
    }

    function getStatusActionKey(translation) {
      if (!translation || !translation._id) {
        return ''
      }
      return `status:${translation._id}`
    }

    function isStatusUpdating(translation) {
      const actionKey = getStatusActionKey(translation)
      if (!actionKey) {
        return false
      }
      return rowActionLoadingMap[actionKey] === true
    }

    function isTranslationPublished(translation) {
      return Number(translation?.status) === 1
    }

    function isStatusSwitchDisabled(translation) {
      return Number(translation?.status) === 99
    }

    function updateTranslationStatus(translation, value) {
      if (!translation || isStatusSwitchDisabled(translation)) {
        return
      }

      const actionKey = getStatusActionKey(translation)
      if (!actionKey || rowActionLoadingMap[actionKey]) {
        return
      }

      let nextStatus = 0
      if (value === true) {
        nextStatus = 1
      }
      if (Number(translation.status) === nextStatus) {
        return
      }

      setRowLoading(actionKey, true)
      multilingualApi
        .updateTranslationPostStatus(
          {
            id: translation._id,
            languageCode: translation.languageCode,
            status: nextStatus
          },
          true
        )
        .then(response => {
          const updatedData = response.data.data || {}
          translation.status = Number(updatedData.status)
          translation.updatedAt = updatedData.updatedAt || translation.updatedAt
          ElMessage.success('状态已更新')
        })
        .catch(error => {
          console.log(error)
        })
        .finally(() => {
          setRowLoading(actionKey, false)
        })
    }

    function updateAiSkip(translation, value) {
      if (!translation) {
        return
      }
      const actionKey = getAiSkipActionKey(translation)
      if (!actionKey || rowActionLoadingMap[actionKey]) {
        return
      }

      setRowLoading(actionKey, true)
      multilingualApi
        .updateTranslationAiSkip(
          {
            contentType: 'post',
            id: translation._id,
            languageCode: translation.languageCode,
            aiTranslationSkip: value === true
          },
          true
        )
        .then(response => {
          const updatedData = response.data.data || {}
          translation.aiTranslationSkip = updatedData.aiTranslationSkip === true
          ElMessage.success('AI 翻译跳过状态已更新')
        })
        .catch(error => {
          console.log(error)
        })
        .finally(() => {
          setRowLoading(actionKey, false)
        })
    }

    function getLanguageList() {
      loading.value = true
      multilingualApi
        .getTranslationPostListBySource({
          sourceSnapshotId: route.params.sourceSnapshotId,
          page: 1,
          limit: 1,
          includeTranslationDetails: true
        })
        .then(response => {
          const responseData = response.data.data || {}
          sourceGroup.value = responseData.list?.[0] || null
        })
        .finally(() => {
          loading.value = false
        })
    }

    function preserveTableScrollForNextRefresh() {
      tableRef.value?.preserveScrollOnNextDataRefresh()
    }

    function createTranslation(languageCode) {
      if (!sourcePost.value) {
        return
      }

      const actionKey = getCreateActionKey(languageCode)
      if (rowActionLoadingMap[actionKey]) {
        return
      }

      setRowLoading(actionKey, true)

      ElMessageBox.confirm(
        `确认为 ${languageCode} 创建多语言文章？`,
        '创建语言版本',
        {
          type: 'info',
          confirmButtonText: '创建',
          cancelButtonText: '取消'
        }
      )
        .then(() => {
          return multilingualApi.createTranslationPost({
            sourceSnapshotId: sourcePost.value._id,
            languageCode,
            copyMode: 'source'
          })
        })
        .then(() => {
          ElMessage.success('创建成功')
          getLanguageList()
        })
        .catch(error => {
          if (error === 'cancel' || error === 'close') {
            return
          }

          const errorCode = error?.response?.data?.errorList?.[0]?.code
          if (errorCode === 'TRANSLATION_EXISTS') {
            const translationPostId = error?.response?.data?.translationPostId
            getLanguageList()
            if (translationPostId) {
              goTranslationEditor({ _id: translationPostId })
            }
            return
          }

          console.log(error)
        })
        .finally(() => {
          setRowLoading(actionKey, false)
        })
    }

    function openRestoreTranslationDialog(translation) {
      snapshotRestorePost.value = translation
      snapshotRestoreDialogVisible.value = true
    }

    function openSourceLinkRewriteDialog(translation) {
      sourceLinkRewritePost.value = translation
      sourceLinkRewriteDialogVisible.value = true
    }

    function goTranslationEditor(translation) {
      router.push({
        name: 'TranslationPostEdit',
        params: { id: translation._id }
      })
    }

    function openAiTranslationDialog(translation) {
      if (!translation || !translation._id) {
        return
      }

      aiTranslationPostId.value = translation._id
      aiTranslationDialogVisible.value = true
    }

    /**
     * el-table 选择列的可选判定：仅已创建的语言版本行可勾选。
     * @param {Object} row 表格行
     * @returns {boolean} 是否可勾选
     */
    function isRowSelectable(row) {
      return Boolean(row && row.translation && row.translation._id)
    }

    function handleSelectionChange(rows) {
      selectedTranslationRows.value = Array.isArray(rows)
        ? rows.filter(isRowSelectable)
        : []
    }

    const batchAiTranslationTargets = computed(() => {
      return selectedTranslationRows.value.filter(isRowSelectable).map(row => {
        const translation = row.translation
        return {
          id: translation._id,
          languageCode: translation.languageCode || row.languageCode,
          title: getPostDisplayTitle(translation),
          sourceLanguageCode: translation.sourceLanguageCode || ''
        }
      })
    })

    function openBatchAiTranslationDialog() {
      if (batchAiTranslationTargets.value.length === 0) {
        ElMessage.warning('请先勾选要批量翻译的语言版本')
        return
      }
      batchAiTranslationDialogVisible.value = true
    }

    function handleBatchAiTranslationSubmitted() {
      preserveTableScrollForNextRefresh()
      getLanguageList()
    }

    function handleAiTranslationSaved() {
      preserveTableScrollForNextRefresh()
      getLanguageList()
    }

    function handleSnapshotRestored() {
      preserveTableScrollForNextRefresh()
      getLanguageList()
    }

    function handleSourceLinkRewriteApplied() {
      preserveTableScrollForNextRefresh()
      getLanguageList()
    }

    onMounted(() => {
      getLanguageList()
    })

    return {
      loading,
      aiTranslationDialogVisible,
      aiTranslationPostId,
      batchAiTranslationDialogVisible,
      selectedTranslationRows,
      batchAiTranslationTargets,
      snapshotRestoreDialogVisible,
      snapshotRestorePost,
      sourceLinkRewriteDialogVisible,
      sourceLinkRewritePost,
      rowActionLoadingMap,
      route,
      tableRef,
      getCreateActionKey,
      sourcePost,
      translationRows,
      isAiSkipUpdating,
      isStatusUpdating,
      isTranslationPublished,
      isStatusSwitchDisabled,
      updateAiSkip,
      updateTranslationStatus,
      createTranslation,
      getLanguageText,
      getPostDisplayTitle,
      getPostStatusText,
      goTranslationEditor,
      openAiTranslationDialog,
      isRowSelectable,
      handleSelectionChange,
      openBatchAiTranslationDialog,
      handleBatchAiTranslationSubmitted,
      handleAiTranslationSaved,
      handleSnapshotRestored,
      handleSourceLinkRewriteApplied,
      openRestoreTranslationDialog,
      openSourceLinkRewriteDialog
    }
  }
}
</script>

<style scoped>
.translation-post-language-page {
  min-width: 0;
}

.translation-language-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.translation-language-toolbar-hint {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.source-title {
  font-weight: 600;
  word-break: break-word;
}

.source-meta {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  word-break: break-all;
}

.table-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.table-empty-text {
  color: var(--el-text-color-secondary);
}

.translation-status-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.translation-row-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.translation-row-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

@media (max-width: 767px) {
  .translation-post-language-page :deep(.el-descriptions__cell) {
    display: block;
    width: 100%;
  }
}
</style>
