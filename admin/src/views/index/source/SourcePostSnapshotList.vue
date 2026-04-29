<template>
  <div class="common-right-panel-form source-post-snapshot-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>源数据管理</el-breadcrumb-item>
        <el-breadcrumb-item>源文章快照</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="clearfix pb20">
      <div class="fl common-top-search-form-body">
        <el-form
          :inline="true"
          :model="params"
          class="snapshot-search-form"
          @submit.prevent
          @keypress.enter="getSourcePostList(true)"
        >
          <el-form-item>
            <el-input
              v-model="params.keyword"
              placeholder="标题、alias、源 ID"
              clearable
              style="width: 220px"
            />
          </el-form-item>
          <el-form-item>
            <el-select
              v-model="params.sourceLanguageCode"
              placeholder="源语言"
              clearable
              style="width: 160px"
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
              v-model="params.hasTranslationLanguageCode"
              placeholder="已有翻译"
              clearable
              style="width: 160px"
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
            <el-input-number
              v-model="params.snapshotVersionMin"
              :min="1"
              controls-position="right"
              placeholder="版本下限"
              style="width: 130px"
            />
          </el-form-item>
          <el-form-item>
            <el-input-number
              v-model="params.snapshotVersionMax"
              :min="1"
              controls-position="right"
              placeholder="版本上限"
              style="width: 130px"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="getSourcePostList(true)">
              搜索
            </el-button>
          </el-form-item>
        </el-form>
      </div>
      <div class="fr snapshot-actions">
        <el-button @click="getSourcePostList(true)">
          <el-icon><Refresh /></el-icon>
        </el-button>
        <el-button type="primary" @click="goImport">导入源文章</el-button>
      </div>
    </div>

    <div class="mb20 list-table-body">
      <ResponsiveTable
        ref="tableRef"
        :data="sourcePostList"
        row-key="_id"
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
        <ResponsiveTableColumn prop="title" label="源标题" min-width="240">
          <template #default="{ row }">
            <div class="snapshot-title">
              {{ getPostDisplayTitle(row) }}
            </div>
            <div class="snapshot-subtitle">{{ row.sourceId }}</div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="源语言" width="150">
          <template #default="{ row }">
            {{ getLanguageText(row.sourceLanguageCode) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn prop="alias" label="Alias" min-width="150" />
        <ResponsiveTableColumn prop="snapshotVersion" label="版本" width="80" />
        <ResponsiveTableColumn label="翻译摘要" min-width="260">
          <template #default="{ row }">
            <div class="translation-summary-line">
              {{ getTranslationProgress(row.translationSummary) }}
            </div>
            <div class="translation-language-tags">
              <el-tag
                v-for="item in getSummaryLanguageList(row.translationSummary)"
                :key="item.value"
                size="small"
                class="mr5 mt5"
                :type="item.exists ? 'success' : 'info'"
                effect="plain"
              >
                {{ item.value }}
              </el-tag>
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="导入时间" width="180">
          <template #default="{ row }">
            {{ $formatDate(row.sourceSnapshotAt) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="更新时间" width="180">
          <template #default="{ row }">
            {{ $formatDate(row.updatedAt) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="openDetail(row)">
              详情
            </el-button>
            <el-button type="warning" size="small" @click="overwrite(row)">
              覆盖
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
      v-model="detailDialogVisible"
      title="源文章快照详情"
      width="80%"
      align-center
      class="source-post-detail-dialog"
      destroy-on-close
    >
      <el-skeleton v-if="detailLoading" :rows="6" animated />
      <template v-else-if="detailData">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="标题">
            {{ getPostDisplayTitle(detailData.post) }}
          </el-descriptions-item>
          <el-descriptions-item label="Alias">
            {{ detailData.post?.alias || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="源语言">
            {{ getLanguageText(detailData.post?.sourceLanguageCode) }}
          </el-descriptions-item>
          <el-descriptions-item label="快照版本">
            {{ detailData.post?.snapshotVersion || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="源 ID">
            {{ detailData.post?.sourceId || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="导入时间">
            {{ $formatDate(detailData.post?.sourceSnapshotAt) }}
          </el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">已创建语言版本</el-divider>
        <div class="translation-language-tags">
          <el-tag
            v-for="item in detailData.translations"
            :key="item._id"
            class="mr5 mb5"
            :type="item.pendingReview ? 'warning' : 'success'"
            effect="plain"
          >
            {{ item.languageCode }} / v{{ item.snapshotVersion }}
          </el-tag>
          <el-empty
            v-if="detailData.translations.length === 0"
            description="暂无翻译版本"
          />
        </div>

        <el-divider content-position="left">关联与媒体</el-divider>
        <div class="detail-count-grid">
          <div class="detail-count-item">
            <div class="detail-count-number">{{ detailData.tags.length }}</div>
            <div>标签</div>
          </div>
          <div class="detail-count-item">
            <div class="detail-count-number">
              {{ detailData.mappointList.length }}
            </div>
            <div>地点</div>
          </div>
          <div class="detail-count-item">
            <div class="detail-count-number">
              {{ detailData.coverImages.length }}
            </div>
            <div>媒体快照</div>
          </div>
          <div class="detail-count-item">
            <div class="detail-count-number">
              {{ getRelationCount(detailData.recommendRelations) }}
            </div>
            <div>推荐关联</div>
          </div>
          <div class="detail-count-item">
            <div class="detail-count-number">
              {{ getRelationCount(detailData.contentRelations) }}
            </div>
            <div>内容关联</div>
          </div>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { multilingualApi } from '@/api'
import {
  SUPPORTED_LANGUAGE_OPTIONS,
  getLanguageText,
  getPostDisplayTitle,
  getPostTypeTagType,
  getPostTypeText,
  getTranslationProgress
} from '@/utils/multilingual'

export default {
  setup() {
    const route = useRoute()
    const router = useRouter()
    const tableRef = ref(null)
    const sourcePostList = ref([])
    const total = ref(0)
    const detailDialogVisible = ref(false)
    const detailLoading = ref(false)
    const detailData = ref(null)
    const params = reactive({
      page: 1,
      limit: 20,
      keyword: route.query.keyword || '',
      sourceLanguageCode: route.query.sourceLanguageCode || '',
      hasTranslationLanguageCode: '',
      snapshotVersionMin: null,
      snapshotVersionMax: null
    })

    const getRequestParams = () => {
      const requestParams = {
        page: params.page,
        limit: params.limit
      }
      if (params.keyword) {
        requestParams.keyword = params.keyword
      }
      if (params.sourceLanguageCode) {
        requestParams.sourceLanguageCode = params.sourceLanguageCode
      }
      if (params.hasTranslationLanguageCode) {
        requestParams.hasTranslationLanguageCode =
          params.hasTranslationLanguageCode
      }
      if (params.snapshotVersionMin) {
        requestParams.snapshotVersionMin = params.snapshotVersionMin
      }
      if (params.snapshotVersionMax) {
        requestParams.snapshotVersionMax = params.snapshotVersionMax
      }
      return requestParams
    }

    const getSourcePostList = resetPage => {
      if (resetPage === true && params.page !== 1) {
        params.page = 1
        return
      }

      multilingualApi
        .getSourcePostList(getRequestParams())
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

    const getSummaryLanguageList = summary => {
      const languages = summary?.languages || {}
      return SUPPORTED_LANGUAGE_OPTIONS.map(item => {
        return {
          ...item,
          exists: Boolean(languages[item.value])
        }
      })
    }

    const overwrite = row => {
      ElMessageBox.confirm(
        `确认覆盖源文章快照「${getPostDisplayTitle(row)}」？旧关联和旧媒体不会自动删除。`,
        '覆盖源快照',
        {
          type: 'warning',
          confirmButtonText: '覆盖',
          cancelButtonText: '取消'
        }
      )
        .then(() => {
          return multilingualApi.overwriteSourcePost({
            sourceId: String(row.sourceId),
            sourceLanguageCode: row.sourceLanguageCode,
            overwrite: true
          })
        })
        .then(() => {
          ElMessage.success('覆盖成功')
          getSourcePostList(false)
        })
        .catch(error => {
          console.log(error)
        })
    }

    const openDetail = row => {
      detailDialogVisible.value = true
      detailLoading.value = true
      detailData.value = null
      multilingualApi
        .getSourcePostDetail({ id: row._id })
        .then(response => {
          detailData.value = response.data.data
        })
        .catch(error => {
          console.log(error)
        })
        .finally(() => {
          detailLoading.value = false
        })
    }

    const getRelationCount = relationGroup => {
      let count = 0
      const group = relationGroup || {}
      Object.keys(group).forEach(key => {
        const list = group[key]
        if (Array.isArray(list)) {
          count += list.length
        }
      })
      return count
    }

    const goImport = () => {
      router.push({ name: 'SourcePostImport' })
    }

    watch(
      () => params.page,
      () => {
        getSourcePostList(false)
      }
    )

    onMounted(() => {
      getSourcePostList(false)
    })

    return {
      tableRef,
      params,
      sourcePostList,
      total,
      languageOptions: SUPPORTED_LANGUAGE_OPTIONS,
      detailDialogVisible,
      detailLoading,
      detailData,
      getLanguageText,
      getPostDisplayTitle,
      getPostTypeTagType,
      getPostTypeText,
      getTranslationProgress,
      getSummaryLanguageList,
      getSourcePostList,
      overwrite,
      openDetail,
      getRelationCount,
      goImport
    }
  }
}
</script>

<style scoped>
.source-post-snapshot-page {
  min-width: 0;
}

.snapshot-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.snapshot-title {
  font-weight: 600;
  word-break: break-word;
}

.snapshot-subtitle {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  word-break: break-all;
}

.translation-summary-line {
  font-weight: 600;
}

.translation-language-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.detail-count-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
}

.detail-count-item {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 12px;
  background: var(--el-bg-color);
  text-align: center;
}

.detail-count-number {
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 4px;
}

@media (max-width: 767px) {
  .snapshot-search-form :deep(.el-form-item) {
    margin-right: 0;
    width: 100%;
  }

  .snapshot-search-form :deep(.el-input),
  .snapshot-search-form :deep(.el-select),
  .snapshot-search-form :deep(.el-input-number) {
    width: 100% !important;
  }

  .snapshot-actions {
    float: none;
    margin-top: 10px;
  }
}
</style>
