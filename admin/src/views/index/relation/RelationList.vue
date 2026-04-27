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
          <el-form-item>
            <el-select v-model="params.languageCode" style="width: 180px">
              <el-option
                v-for="item in languageOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-select v-model="params.collectionName" style="width: 160px">
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
            <div class="relation-title">{{ row.displayName }}</div>
            <div class="relation-subtitle">{{ row._id }}</div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="语言" width="150">
          <template #default="{ row }">
            {{ getLanguageText(row.languageCode) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="类型" width="120">
          <template #default>
            {{ collectionText }}
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
          currentRow.displayName
        }}</el-descriptions-item>
        <el-descriptions-item label="语言">{{
          getLanguageText(currentRow.languageCode)
        }}</el-descriptions-item>
        <el-descriptions-item label="快照版本"
          >v{{ currentRow.snapshotVersion || 1 }}</el-descriptions-item
        >
        <el-descriptions-item label="更新时间">{{
          $formatDate(currentRow.updatedAt || currentRow.createdAt)
        }}</el-descriptions-item>
      </el-descriptions>
      <el-input
        class="mt20"
        :model-value="currentRowText"
        type="textarea"
        :rows="12"
        readonly
      />
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
        title="只允许保存白名单业务字段，系统字段、源快照字段和语言字段会被服务端忽略。"
      />
      <el-input v-model="payloadText" type="textarea" :rows="14" />
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
  getLanguageText
} from '@/utils/multilingual'

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
    const payloadText = ref('{}')
    const params = reactive({
      page: 1,
      limit: 20,
      keyword: '',
      languageCode: 'zh-CN',
      collectionName: 'tags'
    })

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

    const collectionText = computed(() => {
      const item = RELATION_COLLECTION_OPTIONS.find(option => {
        return option.value === params.collectionName
      })
      if (item) {
        return item.label
      }
      return params.collectionName
    })

    const currentRowText = computed(() => {
      if (!currentRow.value) {
        return ''
      }
      return JSON.stringify(currentRow.value, null, 2)
    })

    const getRequestParams = () => {
      const requestParams = {
        page: params.page,
        limit: params.limit,
        languageCode: params.languageCode,
        collectionName: params.collectionName,
        recordKind: 'translation'
      }
      if (isSourceScope.value) {
        requestParams.recordKind = 'source'
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

      multilingualApi
        .getTranslationRelationList(getRequestParams())
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
      payloadText.value = JSON.stringify(row, null, 2)
      editDialogVisible.value = true
    }

    const parsePayload = () => {
      try {
        const payload = JSON.parse(payloadText.value || '{}')
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          ElMessage.error('Payload 必须是 JSON 对象')
          return null
        }
        return payload
      } catch (error) {
        ElMessage.error('Payload JSON 格式错误')
        return null
      }
    }

    const submitUpdate = () => {
      const payload = parsePayload()
      if (!payload || !currentRow.value) {
        return
      }

      submitting.value = true
      multilingualApi
        .updateTranslationRelation({
          collectionName: params.collectionName,
          id: currentRow.value._id,
          languageCode: params.languageCode,
          payload
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
      () => [params.languageCode, params.collectionName, route.meta.scope],
      () => {
        getRelationList(true)
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
      currentRowText,
      detailDialogVisible,
      editDialogVisible,
      submitting,
      payloadText,
      isSourceScope,
      breadcrumbGroup,
      pageTitle,
      collectionText,
      languageOptions: SUPPORTED_LANGUAGE_OPTIONS,
      collectionOptions: RELATION_COLLECTION_OPTIONS,
      getLanguageText,
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
