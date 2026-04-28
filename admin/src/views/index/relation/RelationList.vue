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
          <el-form-item v-if="isMixedCollectionPage">
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
        <el-button :loading="loading" @click="getRelationList(false)">
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>
    </div>

    <div class="mb20 list-table-body" v-loading="loading">
      <ResponsiveTable :data="relationList" row-key="_id" height="100%" border>
        <ResponsiveTableColumn label="名称" min-width="260">
          <template #default="{ row }">
            <div class="relation-title">
              {{ getRelationDisplayName(row) }}
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="语言" width="150">
          <template #default="{ row }">
            {{ getLanguageText(row.languageCode) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn
          v-if="isMixedCollectionPage"
          label="类型"
          width="120"
        >
          <template #default="{ row }">
            {{ getCollectionText(row.collectionName) }}
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
        :current-page="params.page"
        :page-size="params.limit"
        @current-change="handlePageChange"
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
          getCollectionText(detailCollectionName)
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
      width="min(860px, 94vw)"
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
        <RelationBusinessFieldEditor
          :fields="currentEditFields"
          :form="editForm"
          :language-code="editLanguageCode"
          :record="currentRow"
          @parent-updated="handleParentRelationUpdated"
        />
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
import RelationBusinessFieldEditor from '@/components/RelationBusinessFieldEditor.vue'
import { multilingualApi } from '@/api'
import {
  RELATION_COLLECTION_OPTIONS,
  SUPPORTED_LANGUAGE_OPTIONS,
  getLanguageText,
  getRelationDisplayName
} from '@/utils/multilingual'
import {
  getRelationEditFields,
  getRelationFieldInitialValue,
  shouldSubmitRelationEditField
} from '@/utils/relationEditFields'

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
  components: {
    RelationBusinessFieldEditor
  },
  props: {
    scope: {
      type: String,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    collectionName: {
      type: String,
      default: ''
    },
    excludeCollectionNames: {
      type: Array,
      default() {
        return []
      }
    }
  },
  setup(props) {
    const route = useRoute()
    const relationList = ref([])
    const total = ref(0)
    const loading = ref(false)
    const currentRow = ref(null)
    const detailDialogVisible = ref(false)
    const editDialogVisible = ref(false)
    const submitting = ref(false)
    const editForm = reactive({})

    const getDefaultParams = () => {
      const defaultParams = {
        page: 1,
        limit: 20,
        keyword: route.query.keyword || '',
        languageCode: route.query.languageCode || '',
        collectionName: route.query.collectionName || ''
      }

      return defaultParams
    }

    const params = reactive(getDefaultParams())

    const isSourceScope = computed(() => {
      return props.scope === 'source'
    })

    const currentCollectionName = computed(() => {
      return props.collectionName || ''
    })

    const currentExcludeCollectionNames = computed(() => {
      if (Array.isArray(props.excludeCollectionNames)) {
        return props.excludeCollectionNames
      }

      return []
    })

    const isMixedCollectionPage = computed(() => {
      return !currentCollectionName.value
    })

    const collectionOptions = computed(() => {
      return RELATION_COLLECTION_OPTIONS.filter(option => {
        return !currentExcludeCollectionNames.value.includes(option.value)
      })
    })

    const breadcrumbGroup = computed(() => {
      if (isSourceScope.value) {
        return '源数据管理'
      }
      return '多语言数据管理'
    })

    const pageTitle = computed(() => {
      if (props.title) {
        return props.title
      }

      return getCollectionText(currentCollectionName.value)
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
        currentRow.value?.collectionName ||
        currentCollectionName.value ||
        params.collectionName

      return getRelationEditFields(collectionName)
    })

    const editLanguageCode = computed(() => {
      return currentRow.value?.languageCode || params.languageCode || ''
    })

    const detailCollectionName = computed(() => {
      if (!currentRow.value) {
        return currentCollectionName.value || params.collectionName
      }

      return (
        currentRow.value.collectionName ||
        currentCollectionName.value ||
        params.collectionName
      )
    })

    const detailFieldRows = computed(() => {
      if (!currentRow.value) {
        return []
      }

      const fieldList = getRelationEditFields(detailCollectionName.value)

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

      if (currentCollectionName.value) {
        requestParams.collectionName = currentCollectionName.value
      }

      if (!currentCollectionName.value && params.collectionName) {
        requestParams.collectionName = params.collectionName
      }

      if (!currentCollectionName.value && !params.collectionName) {
        requestParams.excludeCollectionNames =
          currentExcludeCollectionNames.value.join(',')
      }

      if (!isSourceScope.value && params.languageCode) {
        requestParams.languageCode = params.languageCode
      }

      if (params.keyword) {
        requestParams.keyword = params.keyword
      }

      return requestParams
    }

    const getRelationList = resetPage => {
      if (
        !currentCollectionName.value &&
        !params.collectionName &&
        currentExcludeCollectionNames.value.length === 0
      ) {
        return
      }

      if (resetPage === true) {
        params.page = 1
      }

      const request = isSourceScope.value
        ? multilingualApi.getSourceRelationList
        : multilingualApi.getTranslationRelationList

      loading.value = true
      request(getRequestParams(), true)
        .then(response => {
          const responseData = response.data.data || {}
          relationList.value = responseData.list || []
          total.value = responseData.total || 0
        })
        .catch(error => {
          console.log(error)
        })
        .finally(() => {
          loading.value = false
        })
    }

    const handlePageChange = page => {
      params.page = page
      getRelationList(false)
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
        editForm[field.name] = getRelationFieldInitialValue(field, row)
      })
      editDialogVisible.value = true
    }

    const buildPayload = () => {
      const payload = {}
      currentEditFields.value.forEach(field => {
        if (!shouldSubmitRelationEditField(field)) {
          return
        }
        payload[field.name] = editForm[field.name]
      })
      return payload
    }

    const handleParentRelationUpdated = ({ field, parentRecord }) => {
      if (!currentRow.value || !field || !parentRecord) {
        return
      }

      currentRow.value[field.name] = parentRecord
      const index = relationList.value.findIndex(item => {
        return item._id === currentRow.value._id
      })
      if (index >= 0) {
        relationList.value[index] = {
          ...relationList.value[index],
          [field.name]: parentRecord
        }
      }
    }

    const submitUpdate = () => {
      if (!currentRow.value) {
        return
      }

      submitting.value = true
      const collectionName =
        currentRow.value.collectionName ||
        currentCollectionName.value ||
        params.collectionName
      const languageCode = currentRow.value.languageCode || params.languageCode
      if (!collectionName || !languageCode) {
        ElMessage.error('缺少关联内容类型或语言信息')
        submitting.value = false
        return
      }

      multilingualApi
        .updateTranslationRelation({
          collectionName,
          id: currentRow.value._id,
          languageCode,
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
      () => route.fullPath,
      () => {
        Object.assign(params, getDefaultParams())
        getRelationList(false)
      }
    )

    onMounted(() => {
      getRelationList(false)
    })

    return {
      params,
      relationList,
      total,
      loading,
      currentRow,
      detailFieldRows,
      detailCollectionName,
      detailDialogVisible,
      editDialogVisible,
      submitting,
      editForm,
      editLanguageCode,
      currentEditFields,
      isSourceScope,
      isMixedCollectionPage,
      collectionOptions,
      breadcrumbGroup,
      pageTitle,
      getCollectionText,
      languageOptions: SUPPORTED_LANGUAGE_OPTIONS,
      getLanguageText,
      getRelationDisplayName,
      getRelationList,
      handlePageChange,
      handleParentRelationUpdated,
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
