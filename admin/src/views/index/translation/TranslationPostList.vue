<template>
  <div class="common-right-panel-form translation-post-list-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>多语言数据管理</el-breadcrumb-item>
        <el-breadcrumb-item>多语言文章</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="clearfix pb20">
      <div class="fl common-top-search-form-body">
        <el-form
          :inline="true"
          :model="params"
          class="translation-search-form"
          @submit.prevent
          @keypress.enter="getTranslationPostList(true)"
        >
          <el-form-item>
            <el-input
              v-model="params.keyword"
              placeholder="标题、摘要、别名、源 ID"
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
              v-model="params.languageCode"
              placeholder="翻译语言"
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
            <el-button type="primary" @click="getTranslationPostList(true)">
              搜索
            </el-button>
          </el-form-item>
        </el-form>
      </div>
      <div class="fr translation-actions">
        <el-button @click="getTranslationPostList(true)">
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>
    </div>

    <div class="mb20 list-table-body">
      <ResponsiveTable
        ref="tableRef"
        :data="sourceGroupList"
        :row-key="getSourceGroupRowKey"
        height="100%"
        border
      >
        <ResponsiveTableColumn label="源文章" min-width="260">
          <template #default="{ row }">
            <div class="source-title">
              {{ getPostDisplayTitle(row.sourcePost) }}
            </div>
            <div v-if="row.sourcePost.alias" class="source-meta">
              Alias: {{ row.sourcePost.alias }}
            </div>
            <div class="source-meta">源 ID：{{ row.sourcePost.sourceId }}</div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="类型" width="90">
          <template #default="{ row }">
            <el-tag effect="plain">{{
              getPostTypeText(row.sourcePost.type)
            }}</el-tag>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="源语言" width="150">
          <template #default="{ row }">
            {{ getLanguageText(row.sourcePost.sourceLanguageCode) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="分类" min-width="160">
          <template #default="{ row }">
            {{ row.sourcePost.sort?.sortname || '-' }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="标签" min-width="220">
          <template #default="{ row }">
            <div v-if="row.sourcePost.tags?.length" class="table-tag-list">
              <el-tag
                v-for="tag in row.sourcePost.tags"
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
              v-if="row.sourcePost.mappointList?.length"
              class="table-tag-list"
            >
              <el-tag
                v-for="mappoint in row.sourcePost.mappointList"
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
            <PostRelationSummary :post="row.sourcePost" />
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="快照版本" width="100">
          <template #default="{ row }"
            >v{{ row.sourcePost.snapshotVersion }}</template
          >
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="语言版本" min-width="280">
          <template #default="{ row }">
            <div class="language-version-tags">
              <el-tag
                v-for="item in getTranslationRows(row)"
                :key="item.languageCode"
                size="small"
                effect="plain"
                :type="getTranslationTagType(item.translation)"
              >
                {{ item.languageCode }}
              </el-tag>
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="导入时间" width="180">
          <template #default="{ row }">
            {{ $formatDate(row.sourcePost.sourceSnapshotAt) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="操作" width="130" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="goLanguageList(row)">
              语言版本
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
      title="编辑多语言文章"
      width="880px"
      destroy-on-close
    >
      <el-skeleton v-if="detailLoading" :rows="6" animated />
      <template v-else-if="detailData">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="标题">
            {{ getPostDisplayTitle(detailData.post) }}
          </el-descriptions-item>
          <el-descriptions-item label="语言">
            {{ getLanguageText(detailData.post?.languageCode) }}
          </el-descriptions-item>
          <el-descriptions-item label="Alias">
            {{ detailData.post?.alias || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            {{ getPostStatusText(detailData.post?.status) }}
          </el-descriptions-item>
          <el-descriptions-item label="快照版本">
            v{{ detailData.post?.snapshotVersion || '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="复核状态">
            <el-tag
              v-if="detailData.post?.pendingReview"
              type="warning"
              effect="plain"
            >
              待复核
            </el-tag>
            <el-tag v-else type="success" effect="plain">正常</el-tag>
          </el-descriptions-item>
        </el-descriptions>
        <el-form
          class="translation-edit-form mt20"
          :model="editForm"
          label-width="90px"
          @submit.prevent
        >
          <el-form-item label="标题">
            <el-input v-model="editForm.title" clearable />
          </el-form-item>
          <el-form-item label="Alias">
            <el-input v-model="editForm.alias" clearable />
          </el-form-item>
          <el-form-item label="摘要">
            <el-input v-model="editForm.excerpt" type="textarea" :rows="3" />
          </el-form-item>
          <el-form-item label="正文">
            <el-input v-model="editForm.content" type="textarea" :rows="12" />
          </el-form-item>
          <el-form-item label="类型">
            <el-select v-model="editForm.type" style="width: 180px">
              <el-option
                v-for="item in postTypeOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="editForm.status" style="width: 180px">
              <el-option
                v-for="item in postStatusOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="日期">
            <el-date-picker
              v-model="editForm.date"
              type="datetime"
              value-format="YYYY-MM-DD HH:mm:ss"
              placeholder="选择日期"
            />
          </el-form-item>
        </el-form>
        <div class="detail-actions mt20">
          <el-button
            v-if="detailData.post?.pendingReview"
            :loading="detailSaving"
            @click="confirmReview"
          >
            确认复核
          </el-button>
          <el-button type="primary" :loading="detailSaving" @click="saveDetail">
            保存
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { onMounted, reactive, ref, watch } from 'vue'
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
  getPostTypeText
} from '@/utils/multilingual'

export default {
  components: {
    PostRelationSummary
  },
  setup() {
    const router = useRouter()
    const tableRef = ref(null)
    const sourceGroupList = ref([])
    const total = ref(0)
    const detailDialogVisible = ref(false)
    const detailLoading = ref(false)
    const detailSaving = ref(false)
    const detailData = ref(null)
    const editForm = reactive({
      title: '',
      alias: '',
      excerpt: '',
      content: '',
      type: 1,
      status: 0,
      date: ''
    })
    const params = reactive({
      page: 1,
      limit: 20,
      keyword: '',
      sourceLanguageCode: '',
      languageCode: '',
      status: '',
      type: ''
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
      if (params.languageCode) {
        requestParams.languageCode = params.languageCode
      }
      if (params.status !== '') {
        requestParams.status = params.status
      }
      if (params.type !== '') {
        requestParams.type = params.type
      }
      return requestParams
    }

    const getTranslationPostList = resetPage => {
      if (resetPage === true && params.page !== 1) {
        params.page = 1
        return
      }

      multilingualApi
        .getTranslationPostListBySource(getRequestParams())
        .then(response => {
          const responseData = response.data.data || {}
          sourceGroupList.value = responseData.list || []
          total.value = responseData.total || 0
          tableRef.value?.scrollTo({ top: 0 })
        })
        .catch(error => {
          console.log(error)
        })
    }

    const getTranslationRows = row => {
      const translations = row.translations || {}
      return SUPPORTED_LANGUAGE_OPTIONS.map(item => {
        return {
          languageCode: item.value,
          translation: translations[item.value]
        }
      })
    }

    const getSourceGroupRowKey = row => {
      if (row.sourcePost?._id) {
        return row.sourcePost._id
      }
      if (row.sourcePost?.sourceId) {
        return row.sourcePost.sourceId
      }

      return row.sourcePost?.translationGroupId || ''
    }

    const getTranslationTagType = translation => {
      if (!translation) {
        return 'info'
      }
      if (translation.pendingReview) {
        return 'warning'
      }
      return 'success'
    }

    const createTranslation = (sourcePost, languageCode) => {
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
            sourceSnapshotId: sourcePost._id,
            languageCode,
            copyMode: 'source'
          })
        })
        .then(() => {
          ElMessage.success('创建成功')
          getTranslationPostList(false)
        })
        .catch(error => {
          console.log(error)
        })
    }

    const openTranslationDetail = translation => {
      detailDialogVisible.value = true
      detailLoading.value = true
      detailData.value = null
      multilingualApi
        .getTranslationPostDetail({ id: translation._id })
        .then(response => {
          detailData.value = response.data.data
          syncEditForm(detailData.value?.post)
        })
        .catch(error => {
          console.log(error)
        })
        .finally(() => {
          detailLoading.value = false
        })
    }

    const goTranslationEditor = translation => {
      router.push({
        name: 'TranslationPostEdit',
        params: { id: translation._id }
      })
    }

    const goLanguageList = row => {
      router.push({
        name: 'TranslationPostLanguageList',
        params: { sourceSnapshotId: row.sourcePost._id }
      })
    }

    const syncEditForm = post => {
      editForm.title = post?.title || ''
      editForm.alias = post?.alias || ''
      editForm.excerpt = post?.excerpt || ''
      editForm.content = post?.content || ''
      editForm.type = Number(post?.type || 1)
      editForm.status = Number(post?.status || 0)
      editForm.date = post?.date || ''
    }

    const saveDetail = () => {
      const post = detailData.value?.post
      if (!post) {
        return
      }

      detailSaving.value = true
      multilingualApi
        .updateTranslationPost({
          id: post._id,
          languageCode: post.languageCode,
          title: editForm.title,
          alias: editForm.alias,
          excerpt: editForm.excerpt,
          content: editForm.content,
          type: editForm.type,
          status: editForm.status,
          date: editForm.date
        })
        .then(response => {
          detailData.value = response.data.data
          syncEditForm(detailData.value?.post)
          ElMessage.success('保存成功')
          getTranslationPostList(false)
        })
        .catch(error => {
          console.log(error)
        })
        .finally(() => {
          detailSaving.value = false
        })
    }

    const confirmReview = () => {
      const post = detailData.value?.post
      if (!post) {
        return
      }

      detailSaving.value = true
      multilingualApi
        .updateTranslationPost({
          id: post._id,
          languageCode: post.languageCode,
          confirmReview: true
        })
        .then(response => {
          detailData.value = response.data.data
          syncEditForm(detailData.value?.post)
          ElMessage.success('复核状态已更新')
          getTranslationPostList(false)
        })
        .catch(error => {
          console.log(error)
        })
        .finally(() => {
          detailSaving.value = false
        })
    }

    watch(
      () => params.page,
      () => {
        getTranslationPostList(false)
      }
    )

    onMounted(() => {
      getTranslationPostList(false)
    })

    return {
      tableRef,
      params,
      sourceGroupList,
      total,
      detailDialogVisible,
      detailLoading,
      detailSaving,
      detailData,
      editForm,
      languageOptions: SUPPORTED_LANGUAGE_OPTIONS,
      postTypeOptions: POST_TYPE_OPTIONS,
      postStatusOptions: POST_STATUS_OPTIONS,
      getLanguageText,
      getPostStatusTagType,
      getPostStatusText,
      getPostTypeText,
      getSourceGroupRowKey,
      getTranslationRows,
      getTranslationTagType,
      getPostDisplayTitle,
      getTranslationPostList,
      createTranslation,
      openTranslationDetail,
      goLanguageList,
      goTranslationEditor,
      saveDetail,
      confirmReview
    }
  }
}
</script>

<style scoped>
.translation-post-list-page {
  min-width: 0;
}

.translation-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.translation-child-table {
  padding: 10px 20px;
  background: var(--el-fill-color-lighter);
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

.language-version-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.detail-actions {
  text-align: right;
}

@media (max-width: 767px) {
  .translation-search-form :deep(.el-form-item) {
    margin-right: 0;
    width: 100%;
  }

  .translation-search-form :deep(.el-input),
  .translation-search-form :deep(.el-select) {
    width: 100% !important;
  }

  .translation-actions {
    float: none;
    margin-top: 10px;
  }
}
</style>
