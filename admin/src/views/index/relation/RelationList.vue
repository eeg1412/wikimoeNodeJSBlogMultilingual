<template>
  <div class="common-right-panel-form relation-list-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>{{ breadcrumbGroup }}</el-breadcrumb-item>
        <el-breadcrumb-item>{{ pageTitle }}</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="clearfix pb20">
      <div class="fl common-top-search-form-body">
        <el-form
          :inline="true"
          :model="params"
          class="relation-search-form"
          @submit.prevent
          @keypress.enter="getRelationList(true)"
        >
          <el-form-item>
            <el-input
              v-model="params.keyword"
              placeholder="名称、标题、文件名、源 ID"
              clearable
              style="width: 240px"
            />
          </el-form-item>
          <el-form-item v-if="!isSourceScope">
            <el-select
              v-model="params.languageCode"
              clearable
              placeholder="全部语言"
              style="width: 180px"
              @change="getRelationList(true)"
              @clear="getRelationList(true)"
            >
              <el-option
                v-for="item in languageOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item v-if="!isSourceScope">
            <el-select
              v-model="params.collectionName"
              clearable
              placeholder="全部类型"
              style="width: 160px"
              @change="getRelationList(true)"
              @clear="getRelationList(true)"
            >
              <el-option
                v-for="item in collectionOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="getRelationList(true)">
              搜索
            </el-button>
          </el-form-item>
        </el-form>
      </div>
      <div class="fr relation-actions">
        <el-button @click="getRelationList(false)">
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>
    </div>

    <div class="mb20 list-table-body">
      <ResponsiveTable
        ref="tableRef"
        :data="relationList"
        row-key="_id"
        height="100%"
        border
      >
        <ResponsiveTableColumn label="名称" min-width="260">
          <template #default="{ row }">
            <div class="relation-title">{{ getRelationDisplayName(row) }}</div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="语言" width="150">
          <template #default="{ row }">
            {{ getLanguageText(row.languageCode) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="类型" width="120">
          <template #default="{ row }">
            {{ getCollectionText(row.collectionName || params.collectionName) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="源 ID" min-width="210">
          <template #default="{ row }">
            {{ row.sourceId || '-' }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="快照版本" width="110">
          <template #default="{ row }">
            v{{ row.snapshotVersion || 1 }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="更新时间" width="180">
          <template #default="{ row }">
            {{ $formatDate(row.updatedAt || row.createdAt) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openDetail(row)">详情</el-button>
            <el-button
              v-if="!isSourceScope"
              type="primary"
              size="small"
              @click="openEdit(row)"
            >
              编辑
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

    <el-dialog v-model="detailDialogVisible" title="关联内容详情" width="760px">
      <el-descriptions v-if="currentRow" :column="2" border>
        <el-descriptions-item label="ID">{{
          currentRow._id
        }}</el-descriptions-item>
        <el-descriptions-item label="源 ID">{{
          currentRow.sourceId || '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="名称">{{
          getRelationDisplayName(currentRow)
        }}</el-descriptions-item>
        <el-descriptions-item label="语言">{{
          getLanguageText(currentRow.languageCode)
        }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{
          getCollectionText(currentRow.collectionName || params.collectionName)
        }}</el-descriptions-item>
        <el-descriptions-item label="快照版本"
          >v{{ currentRow.snapshotVersion || 1 }}</el-descriptions-item
        >
        <el-descriptions-item label="更新时间">{{
          $formatDate(currentRow.updatedAt || currentRow.createdAt)
        }}</el-descriptions-item>
      </el-descriptions>
      <template v-if="currentRow">
        <el-divider content-position="left">业务字段</el-divider>
        <el-descriptions :column="1" border>
          <el-descriptions-item
            v-for="field in detailFieldRows"
            :key="field.name"
            :label="field.label"
          >
            {{ field.value }}
          </el-descriptions-item>
        </el-descriptions>
      </template>
    </el-dialog>

    <el-dialog
      v-model="editDialogVisible"
      title="编辑关联基础字段"
      width="760px"
    >
      <el-alert
        class="mb20"
        type="info"
        :closable="false"
        show-icon
        title="这里只开放可翻译的业务字段；系统字段、源快照字段和语言字段由服务端保护。"
      />
      <el-form
        v-if="currentEditFields.length > 0"
        :model="editForm"
        label-width="110px"
        @submit.prevent
      >
        <el-form-item
          v-for="field in currentEditFields"
          :key="field.name"
          :label="field.label"
        >
          <el-switch
            v-if="field.type === 'boolean'"
            v-model="editForm[field.name]"
          />
          <el-input-number
            v-else-if="field.type === 'number'"
            v-model="editForm[field.name]"
            controls-position="right"
            style="width: 180px"
          />
          <el-input
            v-else-if="field.type === 'textarea'"
            v-model="editForm[field.name]"
            type="textarea"
            :rows="4"
          />
          <el-input v-else v-model="editForm[field.name]" clearable />
        </el-form-item>
      </el-form>
      <el-empty v-else description="当前类型暂无可编辑业务字段" />
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitUpdate">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { multilingualApi } from '@/api'
import {
  RELATION_COLLECTION_OPTIONS,
  SUPPORTED_LANGUAGE_OPTIONS,
  getLanguageText,
  getRelationDisplayName
} from '@/utils/multilingual'

const RELATION_EDIT_FIELD_MAP = {
  users: [
    { name: 'nickname', label: '昵称' },
    { name: 'email', label: '邮箱' },
    { name: 'description', label: '说明', type: 'textarea' }
  ],
  sorts: [
    { name: 'sortname', label: '分类名' },
    { name: 'alias', label: '别名' },
    { name: 'taxis', label: '排序', type: 'number' },
    { name: 'description', label: '说明', type: 'textarea' },
    { name: 'template', label: '模板' }
  ],
  tags: [{ name: 'tagname', label: '标签名' }],
  mappoints: [
    { name: 'title', label: '地点标题' },
    { name: 'summary', label: '摘要', type: 'textarea' },
    { name: 'longitude', label: '经度', type: 'number' },
    { name: 'latitude', label: '纬度', type: 'number' },
    { name: 'zIndex', label: '层级', type: 'number' },
    { name: 'status', label: '状态', type: 'number' }
  ],
  bangumis: [
    { name: 'title', label: '番剧标题' },
    { name: 'summary', label: '简介', type: 'textarea' },
    { name: 'rating', label: '评分', type: 'number' },
    { name: 'year', label: '年份', type: 'number' },
    { name: 'season', label: '季度', type: 'number' },
    { name: 'label', label: '标签' },
    { name: 'giveUp', label: '弃番', type: 'boolean' },
    { name: 'postLinkOpen', label: '开放关联', type: 'boolean' },
    { name: 'status', label: '状态', type: 'number' }
  ],
  movies: [
    { name: 'title', label: '电影标题' },
    { name: 'summary', label: '简介', type: 'textarea' },
    { name: 'rating', label: '评分', type: 'number' },
    { name: 'year', label: '年份', type: 'number' },
    { name: 'month', label: '月份', type: 'number' },
    { name: 'day', label: '日期', type: 'number' },
    { name: 'label', label: '标签' },
    { name: 'postLinkOpen', label: '开放关联', type: 'boolean' },
    { name: 'status', label: '状态', type: 'number' }
  ],
  games: [
    { name: 'title', label: '游戏标题' },
    { name: 'summary', label: '简介', type: 'textarea' },
    { name: 'rating', label: '评分', type: 'number' },
    { name: 'label', label: '标签' },
    { name: 'giveUp', label: '弃坑', type: 'boolean' },
    { name: 'postLinkOpen', label: '开放关联', type: 'boolean' },
    { name: 'status', label: '状态', type: 'number' }
  ],
  gamePlatforms: [
    { name: 'name', label: '平台名' },
    { name: 'color', label: '颜色' }
  ],
  books: [
    { name: 'title', label: '书籍标题' },
    { name: 'summary', label: '简介', type: 'textarea' },
    { name: 'rating', label: '评分', type: 'number' },
    { name: 'label', label: '标签' },
    { name: 'giveUp', label: '弃坑', type: 'boolean' },
    { name: 'postLinkOpen', label: '开放关联', type: 'boolean' },
    { name: 'status', label: '状态', type: 'number' }
  ],
  booktypes: [
    { name: 'name', label: '类型名' },
    { name: 'color', label: '颜色' }
  ],
  events: [
    { name: 'title', label: '活动标题' },
    { name: 'color', label: '颜色' },
    { name: 'content', label: '内容', type: 'textarea' },
    { name: 'status', label: '状态', type: 'number' }
  ],
  eventtypes: [
    { name: 'name', label: '类型名' },
    { name: 'color', label: '颜色' }
  ],
  posts: [
    { name: 'title', label: '标题' },
    { name: 'excerpt', label: '摘要/推文', type: 'textarea' },
    { name: 'alias', label: '别名' },
    { name: 'status', label: '状态', type: 'number' },
    { name: 'allowRemark', label: '允许评论', type: 'boolean' },
    { name: 'top', label: '置顶', type: 'boolean' },
    { name: 'sortop', label: '分类置顶', type: 'boolean' }
  ],
  votes: [
    { name: 'title', label: '投票标题' },
    { name: 'maxSelect', label: '最大选择数', type: 'number' },
    { name: 'showResultAfter', label: '投票后显示结果', type: 'boolean' },
    { name: 'status', label: '状态', type: 'number' }
  ],
  attachments: [
    { name: 'name', label: '媒体名称' },
    { name: 'description', label: '描述', type: 'textarea' },
    { name: 'is360Panorama', label: '360 全景', type: 'boolean' }
  ]
}

function formatFieldValue(value) {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  if (typeof value === 'boolean') {
    if (value) {
      return '是'
    }
    return '否'
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? value.join('，') : '-'
  }

  if (typeof value === 'object') {
    return getRelationDisplayName(value)
  }

  return value
}

export default {
  setup() {
    const route = useRoute()
    const tableRef = ref(null)
    const relationList = ref([])
    const total = ref(0)
    const currentRow = ref(null)
    const detailDialogVisible = ref(false)
    const editDialogVisible = ref(false)
    const submitting = ref(false)
    const editForm = reactive({})

    const getDefaultParams = scope => {
      const defaultParams = {
        page: 1,
        limit: 20,
        keyword: '',
        languageCode: '',
        collectionName: ''
      }

      return defaultParams
    }

    const params = reactive(getDefaultParams(route.meta.scope))

    const isSourceScope = computed(() => {
      return route.meta.scope === 'source'
    })

    const breadcrumbGroup = computed(() => {
      if (isSourceScope.value) {
        return '源数据管理'
      }
      return '多语言数据管理'
    })

    const pageTitle = computed(() => {
      if (isSourceScope.value) {
        return '源关联内容'
      }
      return '关联内容'
    })

    const getCollectionText = collectionName => {
      const item = RELATION_COLLECTION_OPTIONS.find(option => {
        return option.value === collectionName
      })
      if (item) {
        return item.label
      }
      return collectionName || '-'
    }

    const currentEditFields = computed(() => {
      const collectionName =
        currentRow.value?.collectionName || params.collectionName

      return RELATION_EDIT_FIELD_MAP[collectionName] || []
    })

    const detailCollectionName = computed(() => {
      if (!currentRow.value) {
        return params.collectionName
      }

      return currentRow.value.collectionName || params.collectionName
    })

    const detailFieldRows = computed(() => {
      if (!currentRow.value) {
        return []
      }

      const fieldList =
        RELATION_EDIT_FIELD_MAP[detailCollectionName.value] || []

      return fieldList.map(field => ({
        ...field,
        value: formatFieldValue(currentRow.value[field.name])
      }))
    })

    const getRequestParams = () => {
      const requestParams = {
        page: params.page,
        limit: params.limit
      }

      if (params.languageCode) {
        requestParams.languageCode = params.languageCode
      }

      if (params.collectionName) {
        requestParams.collectionName = params.collectionName
      }

      if (params.keyword) {
        requestParams.keyword = params.keyword
      }

      return requestParams
    }

    const getRelationList = resetPage => {
      if (resetPage === true && params.page !== 1) {
        params.page = 1
        return
      }

      const request = isSourceScope.value
        ? multilingualApi.getSourceRelationList
        : multilingualApi.getTranslationRelationList

      request(getRequestParams())
        .then(response => {
          const responseData = response.data.data || {}
          relationList.value = responseData.list || []
          total.value = responseData.total || 0
          tableRef.value?.scrollTo({ top: 0 })
        })
        .catch(error => {
          console.log(error)
        })
    }

    const openDetail = row => {
      currentRow.value = row
      detailDialogVisible.value = true
    }

    const openEdit = row => {
      currentRow.value = row
      Object.keys(editForm).forEach(key => {
        delete editForm[key]
      })
      currentEditFields.value.forEach(field => {
        editForm[field.name] = row[field.name]
      })
      editDialogVisible.value = true
    }

    const buildPayload = () => {
      const payload = {}
      currentEditFields.value.forEach(field => {
        payload[field.name] = editForm[field.name]
      })
      return payload
    }

    const submitUpdate = () => {
      if (!currentRow.value) {
        return
      }

      submitting.value = true
      multilingualApi
        .updateTranslationRelation({
          collectionName:
            currentRow.value.collectionName || params.collectionName,
          id: currentRow.value._id,
          languageCode: currentRow.value.languageCode || params.languageCode,
          payload: buildPayload()
        })
        .then(() => {
          ElMessage.success('保存成功')
          editDialogVisible.value = false
          getRelationList(false)
        })
        .catch(error => {
          console.log(error)
        })
        .finally(() => {
          submitting.value = false
        })
    }

    watch(
      () => params.page,
      () => {
        getRelationList(false)
      }
    )

    watch(
      () => route.meta.scope,
      scope => {
        Object.assign(params, getDefaultParams(scope))
        getRelationList(false)
      }
    )

    onMounted(() => {
      getRelationList(false)
    })

    return {
      tableRef,
      params,
      relationList,
      total,
      currentRow,
      detailFieldRows,
      detailDialogVisible,
      editDialogVisible,
      submitting,
      editForm,
      currentEditFields,
      isSourceScope,
      breadcrumbGroup,
      pageTitle,
      getCollectionText,
      languageOptions: SUPPORTED_LANGUAGE_OPTIONS,
      collectionOptions: RELATION_COLLECTION_OPTIONS,
      getLanguageText,
      getRelationDisplayName,
      getRelationList,
      openDetail,
      openEdit,
      submitUpdate
    }
  }
}
</script>

<style scoped>
.relation-list-page {
  min-width: 0;
}

.relation-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.relation-title {
  font-weight: 600;
  word-break: break-word;
}

.relation-subtitle {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  word-break: break-all;
}

@media (max-width: 767px) {
  .relation-search-form :deep(.el-form-item) {
    margin-right: 0;
    width: 100%;
  }

  .relation-search-form :deep(.el-input),
  .relation-search-form :deep(.el-select) {
    width: 100% !important;
  }

  .relation-actions {
    float: none;
    margin-top: 10px;
  }
}
</style>
