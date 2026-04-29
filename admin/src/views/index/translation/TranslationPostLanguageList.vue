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

      <div class="mb20 list-table-body">
        <ResponsiveTable :data="translationRows" row-key="languageCode" border>
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
                  Alias: {{ row.translation.alias }}
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
          <ResponsiveTableColumn label="状态" width="100">
            <template #default="{ row }">
              <el-tag
                v-if="row.translation"
                :type="getPostStatusTagType(row.translation.status)"
                effect="plain"
              >
                {{ getPostStatusText(row.translation.status) }}
              </el-tag>
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
          <ResponsiveTableColumn label="更新时间" width="180">
            <template #default="{ row }">
              <span v-if="row.translation">
                {{ $formatDate(row.translation.updatedAt) }}
              </span>
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn label="操作" width="250" fixed="right">
            <template #default="{ row }">
              <el-button
                v-if="row.translation"
                type="primary"
                size="small"
                @click="goTranslationEditor(row.translation)"
              >
                编辑
              </el-button>
              <el-button
                v-if="row.translation"
                type="warning"
                size="small"
                :loading="rowActionLoadingMap[row.translation._id]"
                @click="restoreTranslation(row.translation)"
              >
                同步快照
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
            </template>
          </ResponsiveTableColumn>
        </ResponsiveTable>
      </div>
    </template>
    <el-empty v-else description="源文章快照不存在" />
  </div>
</template>

<script>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { multilingualApi } from '@/api'
import PostRelationSummary from '@/components/PostRelationSummary.vue'
import {
  SUPPORTED_LANGUAGE_OPTIONS,
  getLanguageText,
  getPostDisplayTitle,
  getPostStatusTagType,
  getPostStatusText
} from '@/utils/multilingual'

export default {
  name: 'TranslationPostLanguageList',
  components: {
    PostRelationSummary
  },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const loading = ref(false)
    const sourceGroup = ref(null)
    const rowActionLoadingMap = reactive({})

    const sourcePost = computed(() => {
      return sourceGroup.value?.sourcePost || null
    })

    const translationRows = computed(() => {
      const translations = sourceGroup.value?.translations || {}
      return SUPPORTED_LANGUAGE_OPTIONS.map(item => {
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

    function getLanguageList() {
      loading.value = true
      multilingualApi
        .getTranslationPostListBySource({
          sourceSnapshotId: route.params.sourceSnapshotId,
          page: 1,
          limit: 1
        })
        .then(response => {
          const responseData = response.data.data || {}
          sourceGroup.value = responseData.list?.[0] || null
        })
        .finally(() => {
          loading.value = false
        })
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

    function restoreTranslation(translation) {
      ElMessageBox.confirm(
        '确认将该语言版本还原为当前源快照内容，并把状态改为草稿？',
        '同步快照',
        {
          type: 'warning',
          confirmButtonText: '同步快照',
          cancelButtonText: '取消'
        }
      )
        .then(() => {
          setRowLoading(translation._id, true)
          return multilingualApi.restoreTranslationPostSnapshot({
            id: translation._id,
            sourceSnapshotId: route.params.sourceSnapshotId,
            languageCode: translation.languageCode
          })
        })
        .then(() => {
          ElMessage.success('已同步为最新快照草稿')
          getLanguageList()
        })
        .catch(error => {
          if (error !== 'cancel' && error !== 'close') {
            console.log(error)
          }
        })
        .finally(() => {
          setRowLoading(translation._id, false)
        })
    }

    function goTranslationEditor(translation) {
      router.push({
        name: 'TranslationPostEdit',
        params: { id: translation._id }
      })
    }

    onMounted(() => {
      getLanguageList()
    })

    return {
      loading,
      rowActionLoadingMap,
      getCreateActionKey,
      sourcePost,
      translationRows,
      createTranslation,
      getLanguageText,
      getPostDisplayTitle,
      getPostStatusTagType,
      getPostStatusText,
      goTranslationEditor,
      restoreTranslation
    }
  }
}
</script>

<style scoped>
.translation-post-language-page {
  min-width: 0;
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

@media (max-width: 767px) {
  .translation-post-language-page :deep(.el-descriptions__cell) {
    display: block;
    width: 100%;
  }
}
</style>
