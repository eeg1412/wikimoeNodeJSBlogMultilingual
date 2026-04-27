<template>
  <div class="common-right-panel-form source-post-import-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>源数据管理</el-breadcrumb-item>
        <el-breadcrumb-item>源文章导入</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <el-alert
      class="mb20"
      type="info"
      :closable="false"
      show-icon
      title="源文章列表直接读取源站数据库。点击生成快照后写入多语言数据库；覆盖源快照不会删除旧关联、旧媒体和本地文件。"
    />

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
              v-model="params.sourceLanguageCode"
              placeholder="源语言"
              style="width: 180px"
            >
              <el-option
                v-for="item in languageOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
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
            <el-tag effect="plain">{{ getPostTypeText(row.type) }}</el-tag>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="源文章" min-width="280">
          <template #default="{ row }">
            <div class="source-title">
              {{ row.title || row.alias || row.sourceId }}
            </div>
            <div class="source-meta">{{ row.sourceId }}</div>
            <div v-if="row.excerpt" class="source-excerpt">
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
        <ResponsiveTableColumn label="源状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getPostStatusTagType(row.status)" effect="plain">
              {{ getPostStatusText(row.status) }}
            </el-tag>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="快照状态" min-width="190">
          <template #default="{ row }">
            <el-tag v-if="row.hasSnapshot" type="success" effect="plain">
              已生成 v{{ row.snapshot?.snapshotVersion || 1 }}
            </el-tag>
            <el-tag v-else type="info" effect="plain">未生成</el-tag>
            <div class="snapshot-meta" v-if="row.snapshot?.sourceSnapshotAt">
              {{ $formatDate(row.snapshot.sourceSnapshotAt) }}
            </div>
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
              @click="importRow(row)"
            >
              生成快照
            </el-button>
            <el-button
              v-else
              type="warning"
              size="small"
              :loading="rowActionLoadingMap[row.sourceId]"
              @click="overwriteRow(row)"
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

    <el-dialog v-model="resultDialogVisible" title="快照生成结果" width="760px">
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
  </div>
</template>

<script>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { multilingualApi } from '@/api'
import {
  POST_STATUS_OPTIONS,
  POST_TYPE_OPTIONS,
  SUPPORTED_LANGUAGE_OPTIONS,
  getPostStatusTagType,
  getPostStatusText,
  getPostTypeText
} from '@/utils/multilingual'

export default {
  setup() {
    const router = useRouter()
    const tableRef = ref(null)
    const sourcePostList = ref([])
    const total = ref(0)
    const result = ref(null)
    const resultDialogVisible = ref(false)
    const rowActionLoadingMap = reactive({})
    const params = reactive({
      page: 1,
      limit: 20,
      keyword: '',
      sourceLanguageCode: 'zh-CN',
      type: '',
      status: ''
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
        limit: params.limit,
        sourceLanguageCode: params.sourceLanguageCode
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
        translationGroupId: data.translationGroupId,
        snapshotVersion: data.snapshotVersion,
        sourceSnapshotAt: new Date()
      }
    }

    const importRow = async row => {
      setRowLoading(row, true)
      try {
        const response = await multilingualApi.importSourcePost({
          sourceId: String(row.sourceId),
          sourceLanguageCode: params.sourceLanguageCode,
          overwrite: false
        })
        result.value = response.data.data
        syncRowSnapshot(row, result.value)
        resultDialogVisible.value = true
        ElMessage.success('源文章快照生成成功')
        getSourceDatabasePostList(false)
      } catch (error) {
        await handleImportError(row, error)
      } finally {
        setRowLoading(row, false)
      }
    }

    const overwriteRow = row => {
      ElMessageBox.confirm(
        `确认覆盖源文章「${row.title || row.alias || row.sourceId}」的 ${params.sourceLanguageCode} 快照？旧关联和旧媒体不会自动删除。`,
        '确认覆盖源快照',
        {
          type: 'warning',
          confirmButtonText: '覆盖',
          cancelButtonText: '取消'
        }
      )
        .then(() => submitOverwrite(row))
        .catch(error => {
          if (error !== 'cancel' && error !== 'close') {
            console.log(error)
          }
        })
    }

    const submitOverwrite = async row => {
      setRowLoading(row, true)
      try {
        const response = await multilingualApi.overwriteSourcePost({
          sourceId: String(row.sourceId),
          sourceLanguageCode: params.sourceLanguageCode,
          overwrite: true
        })
        result.value = response.data.data
        syncRowSnapshot(row, result.value)
        resultDialogVisible.value = true
        ElMessage.success('源文章快照覆盖成功')
        getSourceDatabasePostList(false)
      } finally {
        setRowLoading(row, false)
      }
    }

    const handleImportError = async (row, error) => {
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
        await submitOverwrite(row)
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
          keyword: String(row.sourceId),
          sourceLanguageCode: params.sourceLanguageCode
        }
      })
    }

    watch(
      () => params.page,
      () => {
        getSourceDatabasePostList(false)
      }
    )

    watch(
      () => params.sourceLanguageCode,
      () => {
        getSourceDatabasePostList(true)
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
      copiedCountRows,
      rowActionLoadingMap,
      getPostTypeText,
      getPostStatusText,
      getPostStatusTagType,
      getSourceDatabasePostList,
      importRow,
      overwriteRow,
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
