<template>
  <div class="common-right-panel-form source-post-import-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>源数据管理</el-breadcrumb-item>
        <el-breadcrumb-item>源文章导入</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="clearfix pb20">
      <div class="fl common-top-search-form-body">
        <el-form
          :inline="true"
          :model="params"
          class="source-post-search-form"
          @submit.prevent
          @keypress.enter="getSourceDatabasePostList(true)"
        >
          <el-form-item>
            <el-input
              v-model="params.keyword"
              placeholder="标题、alias、摘要、源 ID"
              clearable
              style="width: 240px"
            />
          </el-form-item>
          <el-form-item>
            <el-select
              v-model="params.type"
              placeholder="类型"
              clearable
              style="width: 120px"
            >
              <el-option
                v-for="item in postTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-select
              v-model="params.status"
              placeholder="状态"
              clearable
              style="width: 120px"
            >
              <el-option
                v-for="item in postStatusOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="getSourceDatabasePostList(true)">
              搜索
            </el-button>
          </el-form-item>
        </el-form>
      </div>
      <div class="fr source-post-actions">
        <el-button @click="getSourceDatabasePostList(false)">
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>
    </div>

    <div class="mb20 list-table-body">
      <ResponsiveTable
        ref="tableRef"
        :data="sourcePostList"
        row-key="sourceId"
        height="100%"
        border
      >
        <ResponsiveTableColumn label="类型" width="90">
          <template #default="{ row }">
            <el-tag :type="getPostTypeTagType(row.type)" effect="plain">
              {{ getPostTypeText(row.type) }}
            </el-tag>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="源文章" min-width="280">
          <template #default="{ row }">
            <div class="source-title">
              {{ getPostDisplayTitle(row) }}
            </div>
            <div class="source-meta">{{ row.sourceId }}</div>
            <div
              v-if="row.excerpt && Number(row.type) !== 2"
              class="source-excerpt"
            >
              {{ row.excerpt }}
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="作者" min-width="140">
          <template #default="{ row }">
            {{ row.author?.nickname || row.author?.username || '-' }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn prop="alias" label="Alias" min-width="150" />
        <ResponsiveTableColumn label="分类" min-width="160">
          <template #default="{ row }">
            {{ row.sort?.sortname || '-' }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="标签" min-width="220">
          <template #default="{ row }">
            <div v-if="row.tags?.length" class="table-tag-list">
              <el-tag
                v-for="tag in row.tags"
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
            <div v-if="row.mappointList?.length" class="table-tag-list">
              <el-tag
                v-for="mappoint in row.mappointList"
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
            <PostRelationSummary :post="row" />
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="源状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getPostStatusTagType(row.status)" effect="plain">
              {{ getPostStatusText(row.status) }}
            </el-tag>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="快照状态" min-width="190">
          <template #default="{ row }">
            <div
              v-if="row.snapshotSummary?.length"
              class="snapshot-language-tags"
            >
              <el-tag
                v-for="snapshot in row.snapshotSummary"
                :key="snapshot._id"
                type="success"
                size="small"
                effect="plain"
              >
                {{ getLanguageText(snapshot.sourceLanguageCode) }} / v{{
                  snapshot.snapshotVersion || 1
                }}
              </el-tag>
            </div>
            <el-tag v-else type="info" effect="plain">未生成</el-tag>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="源更新时间" width="180">
          <template #default="{ row }">
            {{ $formatDate(row.updatedAt || row.date || row.createdAt) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="操作" width="240" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="!row.hasSnapshot"
              type="primary"
              size="small"
              :loading="rowActionLoadingMap[row.sourceId]"
              @click="openLanguageDialog(row, 'import')"
            >
              生成快照
            </el-button>
            <el-button
              v-if="row.hasSnapshot"
              type="warning"
              size="small"
              :loading="rowActionLoadingMap[row.sourceId]"
              @click="openLanguageDialog(row, 'overwrite')"
            >
              覆盖快照
            </el-button>
            <el-button
              v-if="row.hasSnapshot"
              size="small"
              @click="goSnapshot(row)"
            >
              查看快照
            </el-button>
          </template>
        </ResponsiveTableColumn>
      </ResponsiveTable>
    </div>

    <div class="clearfix">
      <el-pagination
        class="fr"
        background
        layout="total, prev, pager, next"
        :total="total"
        :pager-count="5"
        size="small"
        v-model:current-page="params.page"
        v-model:page-size="params.limit"
      />
    </div>

    <el-dialog
      v-model="resultDialogVisible"
      title="快照生成结果"
      width="760px"
      align-center
    >
      <template v-if="result">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="源快照 ID">
            {{ result.sourceSnapshotId }}
          </el-descriptions-item>
          <el-descriptions-item label="翻译组 ID">
            {{ result.translationGroupId }}
          </el-descriptions-item>
          <el-descriptions-item label="快照版本">
            {{ result.snapshotVersion }}
          </el-descriptions-item>
          <el-descriptions-item label="待复核翻译">
            {{ result.sourceChangedTranslations || 0 }}
          </el-descriptions-item>
        </el-descriptions>
        <div class="mt20" v-if="copiedCountRows.length > 0">
          <div class="result-title">复制统计</div>
          <div class="copied-count-grid">
            <div
              v-for="item in copiedCountRows"
              :key="item.collectionName"
              class="copied-count-item"
            >
              <div class="copied-count-name">{{ item.collectionName }}</div>
              <div class="copied-count-values">
                创建 {{ item.created }} / 复用 {{ item.reused }} / 更新
                {{ item.updated }}
              </div>
            </div>
          </div>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="languageDialogVisible"
      :title="languageDialogTitle"
      width="480px"
      align-center
      destroy-on-close
    >
      <el-form :model="languageForm" label-width="110px" @submit.prevent>
        <el-form-item label="快照语言" required>
          <el-select v-model="languageForm.sourceLanguageCode" class="w_10">
            <el-option
              v-for="item in languageOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="languageDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmLanguageAction">
          确认
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { multilingualApi } from '@/api'
import PostRelationSummary from '@/components/PostRelationSummary.vue'
import {
  POST_STATUS_OPTIONS,
  POST_TYPE_OPTIONS,
  SUPPORTED_LANGUAGE_OPTIONS,
  getLanguageText,
  getPostStatusTagType,
  getPostStatusText,
  getPostDisplayTitle,
  getPostTypeTagType,
  getPostTypeText
} from '@/utils/multilingual'

const SOURCE_IMPORT_LANGUAGE_STORAGE_KEY = 'wikimoe-source-import-language'

export default {
  components: {
    PostRelationSummary
  },
  setup() {
    const router = useRouter()
    const tableRef = ref(null)
    const sourcePostList = ref([])
    const total = ref(0)
    const result = ref(null)
    const resultDialogVisible = ref(false)
    const languageDialogVisible = ref(false)
    const languageAction = ref('import')
    const languageRow = ref(null)
    const rowActionLoadingMap = reactive({})
    const languageForm = reactive({
      sourceLanguageCode: 'zh-CN'
    })
    const params = reactive({
      page: 1,
      limit: 20,
      keyword: '',
      type: '',
      status: ''
    })

    const languageDialogTitle = computed(() => {
      if (languageAction.value === 'overwrite') {
        return '选择要覆盖的快照语言'
      }
      return '选择源文章快照语言'
    })

    const copiedCountRows = computed(() => {
      const copiedCounts = result.value?.copiedCounts || {}
      return Object.keys(copiedCounts).map(collectionName => {
        const item = copiedCounts[collectionName] || {}
        return {
          collectionName,
          created: item.created || 0,
          reused: item.reused || 0,
          updated: item.updated || 0
        }
      })
    })

    const getRequestParams = () => {
      const requestParams = {
        page: params.page,
        limit: params.limit
      }
      if (params.keyword) {
        requestParams.keyword = params.keyword
      }
      if (params.type !== '') {
        requestParams.type = params.type
      }
      if (params.status !== '') {
        requestParams.status = params.status
      }
      return requestParams
    }

    const getSourceDatabasePostList = resetPage => {
      if (resetPage === true && params.page !== 1) {
        params.page = 1
        return
      }

      multilingualApi
        .getSourceDatabasePostList(getRequestParams())
        .then(response => {
          const responseData = response.data.data || {}
          sourcePostList.value = responseData.list || []
          total.value = responseData.total || 0
          tableRef.value?.scrollTo({ top: 0 })
        })
        .catch(error => {
          console.log(error)
        })
    }

    const setRowLoading = (row, value) => {
      rowActionLoadingMap[row.sourceId] = value
    }

    const syncRowSnapshot = (row, data) => {
      row.hasSnapshot = true
      row.snapshot = {
        _id: data.sourceSnapshotId,
        sourceId: row.sourceId,
        sourceLanguageCode: data.sourceLanguageCode,
        translationGroupId: data.translationGroupId,
        snapshotVersion: data.snapshotVersion,
        sourceSnapshotAt: new Date()
      }
      row.snapshotSummary = [
        ...(row.snapshotSummary || []).filter(snapshot => {
          return snapshot.sourceLanguageCode !== data.sourceLanguageCode
        }),
        row.snapshot
      ]
    }

    const getStoredSourceLanguageCode = () => {
      const storedValue = localStorage.getItem(
        SOURCE_IMPORT_LANGUAGE_STORAGE_KEY
      )
      const matched = SUPPORTED_LANGUAGE_OPTIONS.find(item => {
        return item.value === storedValue
      })
      if (matched) {
        return matched.value
      }
      return 'zh-CN'
    }

    const rememberSourceLanguageCode = sourceLanguageCode => {
      localStorage.setItem(
        SOURCE_IMPORT_LANGUAGE_STORAGE_KEY,
        sourceLanguageCode
      )
    }

    const openLanguageDialog = (row, action) => {
      languageRow.value = row
      languageAction.value = action
      languageForm.sourceLanguageCode = getStoredSourceLanguageCode()
      languageDialogVisible.value = true
    }

    const confirmLanguageAction = () => {
      const row = languageRow.value
      if (!row) {
        return
      }
      rememberSourceLanguageCode(languageForm.sourceLanguageCode)
      languageDialogVisible.value = false
      if (languageAction.value === 'overwrite') {
        overwriteRow(row, languageForm.sourceLanguageCode)
        return
      }
      importRow(row, languageForm.sourceLanguageCode)
    }

    const importRow = async (row, sourceLanguageCode) => {
      setRowLoading(row, true)
      try {
        const response = await multilingualApi.importSourcePost({
          sourceId: String(row.sourceId),
          sourceLanguageCode,
          overwrite: false
        })
        result.value = response.data.data
        result.value.sourceLanguageCode = sourceLanguageCode
        syncRowSnapshot(row, result.value)
        resultDialogVisible.value = true
        ElMessage.success('源文章快照生成成功')
        getSourceDatabasePostList(false)
      } catch (error) {
        await handleImportError(row, error, sourceLanguageCode)
      } finally {
        setRowLoading(row, false)
      }
    }

    const overwriteRow = (row, sourceLanguageCode) => {
      ElMessageBox.confirm(
        `确认覆盖源文章「${getPostDisplayTitle(row)}」的 ${sourceLanguageCode} 快照？旧关联和旧媒体不会自动删除。`,
        '确认覆盖源快照',
        {
          type: 'warning',
          confirmButtonText: '覆盖',
          cancelButtonText: '取消'
        }
      )
        .then(() => submitOverwrite(row, sourceLanguageCode))
        .catch(error => {
          if (error !== 'cancel' && error !== 'close') {
            console.log(error)
          }
        })
    }

    const submitOverwrite = async (row, sourceLanguageCode) => {
      setRowLoading(row, true)
      try {
        const response = await multilingualApi.overwriteSourcePost({
          sourceId: String(row.sourceId),
          sourceLanguageCode,
          overwrite: true
        })
        result.value = response.data.data
        result.value.sourceLanguageCode = sourceLanguageCode
        syncRowSnapshot(row, result.value)
        resultDialogVisible.value = true
        ElMessage.success('源文章快照覆盖成功')
        getSourceDatabasePostList(false)
      } finally {
        setRowLoading(row, false)
      }
    }

    const handleImportError = async (row, error, sourceLanguageCode) => {
      const responseData = error?.response?.data || {}
      const errorList = responseData.errorList || []
      const existsError = errorList.find(item => item.code === 'SOURCE_EXISTS')
      if (!existsError) {
        return
      }

      row.hasSnapshot = true
      row.snapshot = {
        _id: responseData.sourceSnapshotId,
        sourceId: row.sourceId,
        snapshotVersion: responseData.snapshotVersion || 1
      }
      try {
        await ElMessageBox.confirm(
          `该源文章已存在快照，当前版本为 ${responseData.snapshotVersion || '-'}。是否立即覆盖？`,
          '源快照已存在',
          {
            type: 'warning',
            confirmButtonText: '覆盖',
            cancelButtonText: '取消'
          }
        )
        await submitOverwrite(row, sourceLanguageCode)
      } catch (confirmError) {
        if (confirmError !== 'cancel' && confirmError !== 'close') {
          console.log(confirmError)
        }
      }
    }

    const goSnapshot = row => {
      router.push({
        name: 'SourcePostSnapshotList',
        query: {
          keyword: String(row.sourceId)
        }
      })
    }

    watch(
      () => params.page,
      () => {
        getSourceDatabasePostList(false)
      }
    )

    onMounted(() => {
      getSourceDatabasePostList(false)
    })

    return {
      tableRef,
      params,
      sourcePostList,
      total,
      languageOptions: SUPPORTED_LANGUAGE_OPTIONS,
      postTypeOptions: POST_TYPE_OPTIONS,
      postStatusOptions: POST_STATUS_OPTIONS,
      result,
      resultDialogVisible,
      languageDialogVisible,
      languageDialogTitle,
      languageForm,
      copiedCountRows,
      rowActionLoadingMap,
      getLanguageText,
      getPostTypeTagType,
      getPostTypeText,
      getPostStatusText,
      getPostStatusTagType,
      getPostDisplayTitle,
      getSourceDatabasePostList,
      confirmLanguageAction,
      openLanguageDialog,
      goSnapshot
    }
  }
}
</script>

<style scoped>
.source-post-import-page {
  min-height: 100%;
}

.source-title {
  font-weight: 600;
  line-height: 1.5;
}

.source-meta,
.snapshot-meta,
.source-excerpt {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.source-excerpt {
  max-width: 560px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.table-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.snapshot-language-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.table-empty-text {
  color: var(--el-text-color-secondary);
}

.result-title {
  font-weight: 600;
  margin-bottom: 10px;
}

.copied-count-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.copied-count-item {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 12px;
  background: var(--el-bg-color);
}

.copied-count-name {
  font-weight: 600;
  margin-bottom: 6px;
}

.copied-count-values {
  color: var(--el-text-color-regular);
  line-height: 1.6;
}

@media (max-width: 767px) {
  .source-post-actions {
    float: none;
  }
}
</style>
