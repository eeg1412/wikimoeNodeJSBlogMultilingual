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
        <ResponsiveTableColumn
          v-if="showAuthorMediaColumn"
          label="头像"
          width="82"
        >
          <template #default="{ row }">
            <div class="relation-media-cell">
              <el-image
                v-if="getAuthorPhotoUrl(row)"
                :src="getAuthorPhotoUrl(row)"
                :preview-src-list="[getAuthorPhotoUrl(row)]"
                preview-teleported
                fit="cover"
                class="relation-media-avatar"
              />
              <div v-else class="relation-media-empty relation-media-avatar">
                -
              </div>
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn
          v-if="showAuthorMediaColumn"
          label="封面"
          width="126"
        >
          <template #default="{ row }">
            <div class="relation-media-cell">
              <el-image
                v-if="getAuthorCoverUrl(row)"
                :src="getAuthorCoverUrl(row)"
                :preview-src-list="[getAuthorCoverUrl(row)]"
                preview-teleported
                fit="cover"
                class="relation-media-cover"
              />
              <div v-else class="relation-media-empty relation-media-cover">
                -
              </div>
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
        <ResponsiveTableColumn
          v-if="!isSourceScope"
          label="AI翻译跳过"
          width="130"
        >
          <template #default="{ row }">
            <el-switch
              :model-value="row.aiTranslationSkip === true"
              :loading="isAiSkipUpdating(row)"
              @change="value => toggleAiSkip(row, value)"
            />
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <div
              v-if="canUseAuthorActionGroup(row)"
              class="relation-row-actions"
            >
              <el-button size="small" @click="openDetail(row)">
                详情
              </el-button>
              <el-dropdown
                trigger="click"
                @command="command => handleAuthorAction(row, command)"
              >
                <el-button type="primary" size="small">
                  作者操作
                  <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="edit">编辑</el-dropdown-item>
                    <el-dropdown-item command="translate">
                      AI 翻译
                    </el-dropdown-item>
                    <el-dropdown-item command="restoreSnapshot">
                      同步快照
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <template v-else>
              <el-button size="small" @click="openDetail(row)">详情</el-button>
              <el-button
                v-if="!isSourceScope"
                type="primary"
                size="small"
                @click="openEdit(row)"
              >
                编辑
              </el-button>
              <el-button
                v-if="!isSourceScope"
                type="success"
                size="small"
                @click="openTranslationDialog(row)"
              >
                AI 翻译
              </el-button>
              <el-button
                v-if="!isSourceScope"
                type="warning"
                size="small"
                @click="restoreSnapshot(row)"
              >
                同步快照
              </el-button>
              <el-button
                v-if="canSyncSourceAuthorMedia(row)"
                type="warning"
                size="small"
                :loading="isSourceAuthorMediaSyncing(row)"
                @click="syncSourceAuthorMedia(row)"
              >
                同步头像封面
              </el-button>
            </template>
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

    <el-dialog
      v-model="detailDialogVisible"
      title="关联内容详情"
      width="760px"
      align-center
    >
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
      align-center
    >
      <el-alert
        class="mb20"
        type="info"
        :closable="false"
        show-icon
        title="这里只开放可翻译的业务字段；系统字段、源快照字段和语言字段由服务端保护。"
      />
      <el-form :model="editForm" label-width="110px" @submit.prevent>
        <RelationBusinessFieldEditor
          v-if="currentEditFields.length > 0"
          :fields="currentEditFields"
          :form="editForm"
          :language-code="editLanguageCode"
          :record="currentRow"
          @parent-updated="handleParentRelationUpdated"
        />
        <el-form-item label="AI翻译跳过">
          <el-switch v-model="editForm.aiTranslationSkip" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="success" @click="openTranslationDialog(currentRow)">
          AI 翻译
        </el-button>
        <el-button type="primary" :loading="submitting" @click="submitUpdate">
          保存
        </el-button>
      </template>
    </el-dialog>

    <ContentAiTranslationDialog
      v-model="aiDialogVisible"
      title="AI 翻译关联内容"
      :content-id="currentAiRecordId"
      content-type="relation"
      :source-language-code="currentAiSourceLanguageCode"
      :target-language-code="currentAiTargetLanguageCode"
      :snapshot-version="currentAiSnapshotVersion"
      :load-source-entries="loadSourceAiEntries"
      :load-current-entries="loadCurrentAiEntries"
      @confirm="confirmAiTranslation"
    />
  </div>
</template>

<script>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import ContentAiTranslationDialog from '@/components/ContentAiTranslationDialog.vue'
import RelationBusinessFieldEditor from '@/components/RelationBusinessFieldEditor.vue'
import { multilingualApi } from '@/api'
import {
  restoreListSessionParams,
  saveListSessionParams
} from '@/composables/useListSessionParams'
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
import {
  buildRecordTranslationEntries,
  buildSourceToTargetTranslationEntries
} from '@/utils/translationJson'

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
    if (
      value.some(
        item => item && typeof item === 'object' && !Array.isArray(item)
      )
    ) {
      const text = value
        .map(item => {
          if (!item || typeof item !== 'object') {
            return ''
          }
          return item.text || item.url || ''
        })
        .filter(Boolean)
        .join('，')
      return text || '-'
    }
    return value.length > 0 ? value.join('，') : '-'
  }

  if (typeof value === 'object') {
    return getRelationDisplayName(value)
  }

  return value
}

export default {
  components: {
    ContentAiTranslationDialog,
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
    const aiDialogVisible = ref(false)
    const aiRecord = ref(null)
    const submitting = ref(false)
    const aiSkipLoadingMap = reactive({})
    const editForm = reactive({})
    const sourceAuthorMediaSyncLoadingMap = reactive({})

    const getDefaultParams = () => {
      const defaultParams = {
        page: 1,
        limit: 20,
        keyword: route.query.keyword || '',
        languageCode: route.query.languageCode || '',
        collectionName: route.query.collectionName || ''
      }

      restoreListSessionParams(route, defaultParams, [
        'keyword',
        'languageCode',
        'collectionName'
      ])
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

    const showAuthorMediaColumn = computed(() => {
      const collectionName =
        currentCollectionName.value || params.collectionName
      return collectionName === 'users'
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

    const isAbsoluteMediaUrl = value => {
      if (!value) {
        return false
      }

      return /^(https?:)?\/\//.test(value) || value.startsWith('/')
    }

    const normalizeMediaUrl = value => {
      if (!value) {
        return ''
      }

      if (isAbsoluteMediaUrl(value)) {
        return value
      }

      return value
    }

    const appendMediaTimestamp = (url, record) => {
      if (!url) {
        return ''
      }

      const stampSource = record?.updatedAt || record?.sourceUpdatedAt
      if (!stampSource) {
        return url
      }

      const stamp = new Date(stampSource).getTime()
      if (!stamp) {
        return url
      }

      const separator = url.includes('?') ? '&' : '?'
      return `${url}${separator}s=${stamp}`
    }

    const getAuthorPhotoUrl = row => {
      return appendMediaTimestamp(normalizeMediaUrl(row?.photo), row)
    }

    const getAuthorCoverUrl = row => {
      const cover = row?.cover
      const previewCandidateList = [
        cover?.localThumbnailPath,
        cover?.localFilepath,
        cover?.thumfor,
        cover?.filepath,
        cover?.remoteFilepath
      ]

      for (const item of previewCandidateList) {
        const previewUrl = normalizeMediaUrl(item)
        if (previewUrl) {
          return appendMediaTimestamp(previewUrl, cover)
        }
      }

      return ''
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

    const currentAiRecordId = computed(() => aiRecord.value?._id || '')
    const currentAiSourceLanguageCode = computed(() => {
      return aiRecord.value?.sourceLanguageCode || ''
    })
    const currentAiTargetLanguageCode = computed(() => {
      return aiRecord.value?.languageCode || ''
    })
    const currentAiSnapshotVersion = computed(() => {
      return Number(aiRecord.value?.snapshotVersion || 1)
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
          saveListSessionParams(route, params)
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
      editForm.aiTranslationSkip = Boolean(row.aiTranslationSkip)
      editDialogVisible.value = true
    }

    const getRowCollectionName = row => {
      if (row?.collectionName) {
        return row.collectionName
      }
      if (currentCollectionName.value) {
        return currentCollectionName.value
      }
      return params.collectionName
    }

    const canSyncSourceAuthorMedia = row => {
      if (!isSourceScope.value) {
        return false
      }
      return getRowCollectionName(row) === 'users'
    }

    const canUseAuthorActionGroup = row => {
      if (isSourceScope.value) {
        return false
      }
      return getRowCollectionName(row) === 'users'
    }

    const getSourceAuthorMediaSyncActionKey = row => {
      if (!row || !row._id) {
        return ''
      }
      return `sourceAuthorMedia:${row._id}`
    }

    const isSourceAuthorMediaSyncing = row => {
      const actionKey = getSourceAuthorMediaSyncActionKey(row)
      return Boolean(actionKey && sourceAuthorMediaSyncLoadingMap[actionKey])
    }

    const getAiSkipActionKey = row => {
      if (!row || !row._id) {
        return ''
      }
      return `aiSkip:${row._id}`
    }

    const isAiSkipUpdating = row => {
      const actionKey = getAiSkipActionKey(row)
      if (!actionKey) {
        return false
      }
      return aiSkipLoadingMap[actionKey] === true
    }

    const toggleAiSkip = (row, value) => {
      if (!row) {
        return
      }
      if (isAiSkipUpdating(row)) {
        return
      }

      const actionKey = getAiSkipActionKey(row)
      if (!actionKey) {
        return
      }

      aiSkipLoadingMap[actionKey] = true
      multilingualApi
        .updateTranslationAiSkip(
          {
            contentType: 'relation',
            collectionName: getRowCollectionName(row),
            id: row._id,
            languageCode: row.languageCode,
            aiTranslationSkip: value === true
          },
          true
        )
        .then(response => {
          const data = response.data.data || {}
          updateRelationListRow({
            ...row,
            ...data,
            aiTranslationSkip: data.aiTranslationSkip === true
          })
          ElMessage.success('AI 翻译跳过状态已更新')
        })
        .catch(error => {
          console.log(error)
        })
        .finally(() => {
          aiSkipLoadingMap[actionKey] = false
        })
    }

    const updateRelationListRow = record => {
      const index = relationList.value.findIndex(item => {
        return item._id === record._id
      })
      if (index >= 0) {
        relationList.value[index] = {
          ...relationList.value[index],
          ...record,
          collectionName: getRowCollectionName(relationList.value[index])
        }
      }
      if (currentRow.value && currentRow.value._id === record._id) {
        currentRow.value = {
          ...currentRow.value,
          ...record,
          collectionName: getRowCollectionName(currentRow.value)
        }
      }
    }

    const syncSourceAuthorMedia = row => {
      if (
        !row ||
        !canSyncSourceAuthorMedia(row) ||
        isSourceAuthorMediaSyncing(row)
      ) {
        return
      }

      const actionKey = getSourceAuthorMediaSyncActionKey(row)
      if (!actionKey) {
        return
      }

      ElMessageBox.confirm(
        '确认使用当前源作者快照，同步全部多语言作者的 photo 和 cover？该操作只会覆盖头像和封面，不会改动昵称、邮箱与说明。',
        '同步多语言作者头像封面',
        {
          type: 'warning',
          confirmButtonText: '同步头像封面',
          cancelButtonText: '取消'
        }
      )
        .then(() => {
          sourceAuthorMediaSyncLoadingMap[actionKey] = true
          return multilingualApi.syncSourceAuthorMedia(
            {
              id: row._id
            },
            true
          )
        })
        .then(response => {
          const result = response.data.data || {}
          const updatedCount = Number(result.updatedCount || 0)
          getRelationList(false)
          if (updatedCount > 0) {
            ElMessage.success(`已同步 ${updatedCount} 个多语言作者的头像和封面`)
            return
          }
          ElMessage.warning('当前源作者还没有可同步的多语言作者')
        })
        .catch(error => {
          if (error !== 'cancel' && error !== 'close') {
            console.log(error)
          }
        })
        .finally(() => {
          sourceAuthorMediaSyncLoadingMap[actionKey] = false
        })
    }

    const handleAuthorAction = (row, command) => {
      if (command === 'edit') {
        openEdit(row)
        return
      }
      if (command === 'translate') {
        openTranslationDialog(row)
        return
      }
      if (command === 'restoreSnapshot') {
        restoreSnapshot(row)
      }
    }

    const buildAiEntries = record => {
      const collectionName = getRowCollectionName(record)
      return buildRecordTranslationEntries({
        record,
        collectionName,
        groupLabel: getCollectionText(collectionName),
        includeEmpty: true
      })
    }

    const mapSourceEntriesToCurrent = (sourceEntries, currentEntries) => {
      return buildSourceToTargetTranslationEntries({
        sourceEntries,
        targetEntries: currentEntries
      }).entries
    }

    const loadCurrentAiEntries = async () => {
      return {
        entries: aiRecord.value ? buildAiEntries(aiRecord.value) : []
      }
    }

    const loadSourceAiEntries = async (currentEntries, sourceLanguageCode) => {
      if (!aiRecord.value?.sourceId || !sourceLanguageCode) {
        return { entries: [] }
      }
      const collectionName = getRowCollectionName(aiRecord.value)
      const response = await multilingualApi.getSourceRelationList(
        {
          collectionName,
          sourceId: aiRecord.value.sourceId,
          languageCode: sourceLanguageCode,
          page: 1,
          limit: 1
        },
        true
      )
      const list = response.data.data?.list || []
      const sourceRecord = list.find(item => {
        return String(item.sourceId) === String(aiRecord.value.sourceId)
      })
      if (!sourceRecord) {
        return { entries: [] }
      }
      return {
        entries: mapSourceEntriesToCurrent(
          buildAiEntries(sourceRecord),
          currentEntries
        )
      }
    }

    const openTranslationDialog = row => {
      if (!row) {
        return
      }
      aiRecord.value = row
      aiDialogVisible.value = true
    }

    const confirmAiTranslation = async (payload, done, applyPlan = {}) => {
      if (!aiRecord.value) {
        done?.()
        return
      }
      const collectionName = getRowCollectionName(aiRecord.value)
      const relationUpdates = applyPlan.relationUpdates || []
      try {
        await Promise.all(
          relationUpdates.map(updateItem => {
            return multilingualApi.updateTranslationRelation({
              collectionName: updateItem.collectionName,
              id: updateItem.id,
              languageCode: aiRecord.value.languageCode,
              payload: {
                ...updateItem.payload,
                aiTranslationSkip: true
              }
            })
          })
        )

        if (Object.keys(payload).length > 0) {
          const response = await multilingualApi.updateTranslationRelation({
            collectionName,
            id: aiRecord.value._id,
            languageCode: aiRecord.value.languageCode,
            payload: {
              ...payload,
              aiTranslationSkip: true
            }
          })
          updateRelationListRow(response.data.data)
          Object.keys(payload).forEach(key => {
            editForm[key] = payload[key]
          })
        }
        getRelationList(false)
        aiDialogVisible.value = false
        ElMessage.success('AI 翻译已写入')
      } catch (error) {
        console.log(error)
      } finally {
        done?.()
      }
    }

    const restoreSnapshot = row => {
      if (!row) {
        return
      }
      ElMessageBox.confirm('确认将该内容还原为当前源快照？', '同步快照', {
        type: 'warning',
        confirmButtonText: '同步快照',
        cancelButtonText: '取消'
      })
        .then(() => {
          return multilingualApi.restoreTranslationRelationSnapshot({
            collectionName: getRowCollectionName(row),
            id: row._id,
            languageCode: row.languageCode
          })
        })
        .then(response => {
          updateRelationListRow(response.data.data)
          getRelationList(false)
          ElMessage.success('已同步为最新快照')
        })
        .catch(error => {
          if (error !== 'cancel' && error !== 'close') {
            console.log(error)
          }
        })
    }

    const buildPayload = () => {
      const payload = {}
      currentEditFields.value.forEach(field => {
        if (!shouldSubmitRelationEditField(field)) {
          return
        }
        payload[field.name] = editForm[field.name]
      })
      payload.aiTranslationSkip = editForm.aiTranslationSkip === true
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
      aiDialogVisible,
      loading,
      currentRow,
      detailFieldRows,
      detailCollectionName,
      detailDialogVisible,
      editDialogVisible,
      submitting,
      editForm,
      editLanguageCode,
      currentAiRecordId,
      currentAiSnapshotVersion,
      currentAiSourceLanguageCode,
      currentAiTargetLanguageCode,
      currentEditFields,
      isSourceScope,
      isMixedCollectionPage,
      collectionOptions,
      breadcrumbGroup,
      pageTitle,
      getCollectionText,
      showAuthorMediaColumn,
      getAuthorPhotoUrl,
      getAuthorCoverUrl,
      languageOptions: SUPPORTED_LANGUAGE_OPTIONS,
      getLanguageText,
      getRelationDisplayName,
      isAiSkipUpdating,
      canSyncSourceAuthorMedia,
      canUseAuthorActionGroup,
      isSourceAuthorMediaSyncing,
      getRelationList,
      handlePageChange,
      handleAuthorAction,
      handleParentRelationUpdated,
      toggleAiSkip,
      confirmAiTranslation,
      loadCurrentAiEntries,
      loadSourceAiEntries,
      openTranslationDialog,
      openDetail,
      openEdit,
      syncSourceAuthorMedia,
      restoreSnapshot,
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

.relation-media-cell {
  display: flex;
  align-items: center;
  justify-content: center;
}

.relation-media-avatar,
.relation-media-cover,
.relation-media-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
}

.relation-media-avatar {
  width: 44px;
  height: 44px;
  border-radius: 999px;
}

.relation-media-cover {
  width: 88px;
  height: 44px;
  border-radius: 8px;
}

.relation-row-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.relation-row-actions :deep(.el-button + .el-button) {
  margin-left: 0;
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

  .relation-media-avatar {
    width: 40px;
    height: 40px;
  }

  .relation-media-cover {
    width: 72px;
    height: 40px;
  }
}
</style>
