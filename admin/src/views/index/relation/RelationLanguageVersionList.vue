<template>
  <div class="common-right-panel-form relation-language-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item :to="{ name: sourceListRouteName }">
          多语言{{ title }}
        </el-breadcrumb-item>
        <el-breadcrumb-item>{{ title }}语言版本</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <el-skeleton v-if="loading && !sourceRecord" :rows="8" animated />
    <template v-else-if="sourceRecord">
      <el-descriptions class="mb20" :column="2" border>
        <el-descriptions-item label="源数据">
          {{ getRelationDisplayName(sourceRecord) }}
        </el-descriptions-item>
        <el-descriptions-item label="源语言">
          {{ getLanguageText(getSourceLanguageCode(sourceRecord)) }}
        </el-descriptions-item>
        <el-descriptions-item label="源 ID">
          {{ sourceRecord.sourceId || sourceId || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="快照版本">
          v{{ sourceRecord.snapshotVersion || 1 }}
        </el-descriptions-item>
      </el-descriptions>

      <div class="mb20 list-table-body" v-loading="loading">
        <ResponsiveTable
          :data="languageRows"
          row-key="languageCode"
          height="100%"
          border
        >
          <ResponsiveTableColumn label="语言" width="150">
            <template #default="{ row }">
              {{ row.languageText }}
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn label="状态" width="130">
            <template #default="{ row }">
              <el-tag v-if="row.record" type="success" effect="plain">
                已创建
              </el-tag>
              <el-tag v-else type="info" effect="plain">未创建</el-tag>
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn label="显示名称" min-width="220">
            <template #default="{ row }">
              <span v-if="row.record">{{
                getRelationDisplayName(row.record)
              }}</span>
              <span v-else class="cGray666">-</span>
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn label="AI跳过" width="120">
            <template #default="{ row }">
              <el-switch
                v-if="row.record"
                :model-value="row.record.aiTranslationSkip === true"
                :loading="isAiSkipUpdating(row.record)"
                @change="value => toggleAiSkip(row.record, value)"
              />
              <span v-else class="cGray666">-</span>
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn label="快照版本" width="120">
            <template #default="{ row }">
              <span v-if="row.record">{{
                row.record.snapshotVersion || '-'
              }}</span>
              <span v-else class="cGray666">-</span>
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn label="更新时间" width="180">
            <template #default="{ row }">
              <span v-if="row.record">
                {{ $formatDate(row.record.updatedAt || row.record.createdAt) }}
              </span>
              <span v-else class="cGray666">-</span>
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn label="操作" width="120" fixed="right">
            <template #default="{ row }">
              <el-dropdown
                v-if="row.record"
                trigger="click"
                @command="command => handleRelationActionCommand(row.record, command)"
              >
                <el-button type="primary" size="small">
                  版本操作
                  <el-icon class="el-icon--right"><ArrowDown /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="detail">
                      <el-icon><View /></el-icon>
                      <span>详情</span>
                    </el-dropdown-item>
                    <el-dropdown-item command="edit">
                      <el-icon><EditPen /></el-icon>
                      <span>编辑</span>
                    </el-dropdown-item>
                    <el-dropdown-item command="aiTranslate">
                      <el-icon><MagicStick /></el-icon>
                      <span>AI 翻译</span>
                    </el-dropdown-item>
                    <el-dropdown-item command="restoreSnapshot">
                      <el-icon><Refresh /></el-icon>
                      <span>同步快照</span>
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-button v-else size="small" disabled>待创建</el-button>
            </template>
          </ResponsiveTableColumn>
        </ResponsiveTable>
      </div>
    </template>
    <el-empty v-else description="未找到源数据" />

    <el-dialog
      v-model="detailDialogVisible"
      title="关联内容详情"
      width="760px"
      align-center
    >
      <el-descriptions v-if="currentRow" :column="2" border>
        <el-descriptions-item label="ID">
          {{ currentRow._id }}
        </el-descriptions-item>
        <el-descriptions-item label="源 ID">
          {{ currentRow.sourceId || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="名称">
          {{ getRelationDisplayName(currentRow) }}
        </el-descriptions-item>
        <el-descriptions-item label="语言">
          {{ getLanguageText(currentRow.languageCode) }}
        </el-descriptions-item>
        <el-descriptions-item label="类型">
          {{ getCollectionText(currentCollectionName) }}
        </el-descriptions-item>
        <el-descriptions-item label="快照版本">
          v{{ currentRow.snapshotVersion || 1 }}
        </el-descriptions-item>
        <el-descriptions-item label="更新时间">
          {{ $formatDate(currentRow.updatedAt || currentRow.createdAt) }}
        </el-descriptions-item>
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
          :language-code="currentRow?.languageCode || ''"
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
        <el-button type="primary" :loading="submitting" @click="submitEdit">
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
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowDown,
  EditPen,
  MagicStick,
  Refresh,
  View
} from '@element-plus/icons-vue'
import ContentAiTranslationDialog from '@/components/ContentAiTranslationDialog.vue'
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
      value.some(item => {
        return item && typeof item === 'object' && !Array.isArray(item)
      })
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
    if (value.length > 0) {
      return value.join('，')
    }
    return '-'
  }

  if (typeof value === 'object') {
    return getRelationDisplayName(value)
  }

  return value
}

export default {
  name: 'RelationLanguageVersionList',
  components: {
    ArrowDown,
    ContentAiTranslationDialog,
    EditPen,
    MagicStick,
    Refresh,
    RelationBusinessFieldEditor,
    View
  },
  props: {
    title: {
      type: String,
      required: true
    },
    collectionName: {
      type: String,
      default: ''
    },
    sourceListRouteName: {
      type: String,
      required: true
    }
  },
  setup(props) {
    const route = useRoute()
    const sourceId = computed(() => {
      return String(route.params.sourceId || '')
    })
    const currentCollectionName = computed(() => {
      return props.collectionName || String(route.params.collectionName || '')
    })
    const sourceRecord = ref(null)
    const translationList = ref([])
    const loading = ref(false)
    const submitting = ref(false)
    const detailDialogVisible = ref(false)
    const editDialogVisible = ref(false)
    const aiDialogVisible = ref(false)
    const currentRow = ref(null)
    const aiRecord = ref(null)
    const editForm = reactive({})
    const aiSkipLoadingMap = reactive({})
    const currentEditFields = computed(() => {
      return getRelationEditFields(currentCollectionName.value)
    })

    const currentAiRecordId = computed(() => {
      return aiRecord.value?._id || ''
    })

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

      return currentEditFields.value.map(field => {
        return {
          ...field,
          value: formatFieldValue(currentRow.value[field.name])
        }
      })
    })

    const getSourceLanguageCode = record => {
      return record?.sourceLanguageCode || record?.languageCode || ''
    }

    const languageRows = computed(() => {
      const translationMap = new Map()
      translationList.value.forEach(item => {
        translationMap.set(item.languageCode, item)
      })
      const sourceLanguageCode = getSourceLanguageCode(sourceRecord.value)
      return SUPPORTED_LANGUAGE_OPTIONS.filter(item => {
        return item.value !== sourceLanguageCode
      }).map(item => {
        return {
          languageCode: item.value,
          languageText: item.label,
          record: translationMap.get(item.value) || null
        }
      })
    })

    const loadSourceRecord = () => {
      return multilingualApi
        .getSourceRelationList(
          {
            collectionName: currentCollectionName.value,
            sourceId: sourceId.value,
            page: 1,
            limit: 1
          },
          true
        )
        .then(response => {
          const responseData = response.data.data || {}
          const list = responseData.list || []
          sourceRecord.value = list[0] || null
        })
    }

    const loadTranslationList = () => {
      return multilingualApi
        .getTranslationRelationList(
          {
            collectionName: currentCollectionName.value,
            sourceId: sourceId.value,
            page: 1,
            limit: 100
          },
          true
        )
        .then(response => {
          const responseData = response.data.data || {}
          translationList.value = responseData.list || []
        })
    }

    const loadPageData = () => {
      if (!sourceId.value || !currentCollectionName.value) {
        return
      }
      loading.value = true
      Promise.all([loadSourceRecord(), loadTranslationList()])
        .catch(error => {
          console.log(error)
        })
        .finally(() => {
          loading.value = false
        })
    }

    const getAiSkipActionKey = row => {
      if (!row?._id) {
        return ''
      }
      return `${row._id}-${row.languageCode}`
    }

    const isAiSkipUpdating = row => {
      const actionKey = getAiSkipActionKey(row)
      if (!actionKey) {
        return false
      }
      return aiSkipLoadingMap[actionKey] === true
    }

    const updateTranslationRow = data => {
      const index = translationList.value.findIndex(item => {
        return String(item._id) === String(data._id)
      })
      if (index === -1) {
        return
      }
      translationList.value.splice(index, 1, {
        ...translationList.value[index],
        ...data
      })
    }

    const getCollectionText = collectionName => {
      const item = RELATION_COLLECTION_OPTIONS.find(option => {
        return option.value === collectionName
      })
      if (item) {
        return item.label
      }
      return collectionName || '-'
    }

    const openDetail = row => {
      currentRow.value = row
      detailDialogVisible.value = true
    }

    const handleRelationActionCommand = (row, command) => {
      if (command === 'detail') {
        openDetail(row)
        return
      }
      if (command === 'edit') {
        openEdit(row)
        return
      }
      if (command === 'aiTranslate') {
        openTranslationDialog(row)
        return
      }
      if (command === 'restoreSnapshot') {
        restoreSnapshot(row)
      }
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
            collectionName: currentCollectionName.value,
            id: row._id,
            languageCode: row.languageCode,
            aiTranslationSkip: value === true
          },
          true
        )
        .then(response => {
          const data = response.data.data || {}
          updateTranslationRow({
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

    const buildAiEntries = record => {
      const collectionName = currentCollectionName.value
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
      const response = await multilingualApi.getSourceRelationList(
        {
          collectionName: currentCollectionName.value,
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
            collectionName: currentCollectionName.value,
            id: aiRecord.value._id,
            languageCode: aiRecord.value.languageCode,
            payload: {
              ...payload,
              aiTranslationSkip: true
            }
          })
          const updatedRow = response.data.data || {}
          updateTranslationRow(updatedRow)
          if (currentRow.value && currentRow.value._id === updatedRow._id) {
            currentRow.value = {
              ...currentRow.value,
              ...updatedRow
            }
          }
          Object.keys(payload).forEach(key => {
            editForm[key] = payload[key]
          })
        }
        loadTranslationList()
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
            collectionName: currentCollectionName.value,
            id: row._id,
            languageCode: row.languageCode
          })
        })
        .then(response => {
          const updatedRow = response.data.data || {}
          updateTranslationRow(updatedRow)
          if (currentRow.value && currentRow.value._id === updatedRow._id) {
            currentRow.value = {
              ...currentRow.value,
              ...updatedRow
            }
          }
          ElMessage.success('已同步为最新快照')
        })
        .catch(error => {
          if (error !== 'cancel' && error !== 'close') {
            console.log(error)
          }
        })
    }

    const submitEdit = () => {
      if (!currentRow.value) {
        return
      }
      const payload = {}
      currentEditFields.value.forEach(field => {
        if (!shouldSubmitRelationEditField(field)) {
          return
        }
        payload[field.name] = editForm[field.name]
      })
      payload.aiTranslationSkip = editForm.aiTranslationSkip === true

      submitting.value = true
      multilingualApi
        .updateTranslationRelation(
          {
            collectionName: currentCollectionName.value,
            id: currentRow.value._id,
            languageCode: currentRow.value.languageCode,
            payload
          },
          true
        )
        .then(response => {
          const data = response.data.data || {}
          updateTranslationRow({
            ...currentRow.value,
            ...payload,
            ...data
          })
          editDialogVisible.value = false
          ElMessage.success(`${props.title}语言版本已保存`)
        })
        .catch(error => {
          console.log(error)
        })
        .finally(() => {
          submitting.value = false
        })
    }

    const handleParentRelationUpdated = ({ field, parentRecord }) => {
      if (!currentRow.value || !field || !parentRecord) {
        return
      }
      currentRow.value[field.name] = parentRecord
      updateTranslationRow({
        ...currentRow.value,
        [field.name]: parentRecord
      })
    }

    onMounted(() => {
      loadPageData()
    })

    return {
      sourceId,
      sourceRecord,
      languageRows,
      loading,
      submitting,
      detailDialogVisible,
      editDialogVisible,
      aiDialogVisible,
      currentRow,
      editForm,
      currentEditFields,
      currentAiRecordId,
      currentAiSourceLanguageCode,
      currentAiTargetLanguageCode,
      currentAiSnapshotVersion,
      currentCollectionName,
      detailFieldRows,
      loadPageData,
      getLanguageText,
      getRelationDisplayName,
      getSourceLanguageCode,
      getCollectionText,
      isAiSkipUpdating,
      toggleAiSkip,
      handleRelationActionCommand,
      openEdit,
      openTranslationDialog,
      loadCurrentAiEntries,
      loadSourceAiEntries,
      confirmAiTranslation,
      submitEdit,
      handleParentRelationUpdated
    }
  }
}
</script>

<style scoped>
.relation-language-page {
  min-width: 0;
}
</style>
