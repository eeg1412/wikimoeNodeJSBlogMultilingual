<template>
  <div class="common-right-panel-form source-post-proper-noun-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>源数据管理</el-breadcrumb-item>
        <el-breadcrumb-item :to="{ name: 'SourcePostImport' }">
          源文章导入
        </el-breadcrumb-item>
        <el-breadcrumb-item>名词管理</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="source-post-term-header mb20">
      <div class="source-post-term-title-block">
        <div class="source-post-term-title">{{ sourcePostTitle }}</div>
        <div class="source-post-term-meta">{{ sourceId || '-' }}</div>
      </div>
      <div class="source-post-term-header-actions">
        <el-button @click="goBack">返回</el-button>
        <ProperNounInternetSearchButton
          button-text="联网检索"
          :term-ids="selectedTermIds"
          :default-language-codes="internetSearchDefaultLanguageCodes"
          :count="selectedTermIds.length"
          :disabled="selectedTermIds.length === 0"
          title="联网检索名词译名"
          @applied="handleInternetSearchApplied"
        />
        <el-button type="primary" plain @click="openOrganizeDialog">
          整理名词
        </el-button>
      </div>
    </div>

    <div class="clearfix pb20">
      <div class="fl common-top-search-form-body">
        <el-form
          :inline="true"
          :model="params"
          class="source-post-term-search-form"
          @submit.prevent
          @keypress.enter="getTermList(true)"
        >
          <el-form-item>
            <el-input
              v-model="params.keyword"
              placeholder="原文、备注"
              clearable
              style="width: 220px"
            />
          </el-form-item>
          <el-form-item>
            <el-select
              v-model="params.languageCode"
              placeholder="译名语言"
              clearable
              filterable
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
            <el-button type="primary" @click="getTermList(true)">
              搜索
            </el-button>
          </el-form-item>
        </el-form>
      </div>
      <div class="fr source-post-term-actions">
        <div class="source-post-term-count">关联名词 {{ relationCount }}</div>
        <div class="source-post-term-action-buttons">
          <el-button @click="getTermList(false)">
            <el-icon><Refresh /></el-icon>
          </el-button>
          <el-button type="primary" @click="openCreateTermDialog">
            <el-icon><Plus /></el-icon>
            新增名词
          </el-button>
        </div>
      </div>
    </div>

    <div class="mb20 list-table-body">
      <ResponsiveTable
        ref="tableRef"
        v-loading="loading"
        :data="termList"
        row-key="_id"
        height="100%"
        border
        @selection-change="handleTermSelectionChange"
      >
        <ResponsiveTableColumn type="selection" width="48" reserve-selection />
        <ResponsiveTableColumn label="原文名词" min-width="240">
          <template #default="{ row }">
            <div class="source-post-term-source-text">
              {{ row.sourceText }}
            </div>
            <div
              v-if="row.relation?.relationSource"
              class="source-post-term-note"
            >
              {{ getRelationSourceText(row.relation.relationSource) }}
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="译名" min-width="280">
          <template #default="{ row }">
            <div
              v-if="getDisplayedTranslations(row).length > 0"
              class="source-post-term-translation-list"
            >
              <el-tag
                v-for="translation in getDisplayedTranslations(row)"
                :key="translation._id"
                type="primary"
                effect="plain"
              >
                {{ getLanguageText(translation.languageCode) }}：{{
                  translation.translatedText
                }}
              </el-tag>
            </div>
            <span v-else class="table-empty-text">暂无译名</span>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="备注" min-width="200">
          <template #default="{ row }">
            <div v-if="row.note" class="source-post-term-note-cell">
              {{ row.note }}
            </div>
            <span v-else class="table-empty-text">-</span>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="使用情况" width="180">
          <template #default="{ row }">
            <div class="source-post-term-usage">
              <div class="source-post-term-usage-count">
                {{ getCountText(row.usedCount) }} 次
              </div>
              <div class="source-post-term-usage-date">
                最后：{{ getLastUsedAtText(row.lastUsedAt) }}
              </div>
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="关联时间" width="180">
          <template #default="{ row }">
            {{ getRelationUpdatedAtText(row) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="操作" width="410" fixed="right">
          <template #default="{ row }">
            <div class="source-post-term-row-actions">
              <ProperNounInternetSearchButton
                button-text="联网检索"
                size="small"
                :term-ids="getRowTermIds(row)"
                :default-language-codes="internetSearchDefaultLanguageCodes"
                title="联网检索名词译名"
                @applied="handleInternetSearchApplied"
              />
              <el-button
                type="primary"
                size="small"
                @click="openTranslationDialog(row)"
              >
                译名
              </el-button>
              <el-button size="small" @click="openEditTermDialog(row)">
                编辑
              </el-button>
              <el-button size="small" @click="unbindTerm(row)">
                解绑
              </el-button>
              <el-button type="danger" size="small" @click="deleteTerm(row)">
                删除
              </el-button>
            </div>
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
      v-model="termDialogVisible"
      :title="termDialogTitle"
      width="min(680px, 96vw)"
      append-to-body
      destroy-on-close
    >
      <el-form
        :model="termForm"
        label-width="120px"
        class="source-post-term-form"
      >
        <el-form-item label="原文名词" required>
          <el-input
            v-model="termForm.sourceText"
            maxlength="300"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="原文语言">
          <el-select
            v-model="termForm.sourceLanguageCode"
            clearable
            filterable
            class="w_10"
            placeholder="可不指定"
          >
            <el-option
              v-for="item in languageOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="termForm.note" type="textarea" :rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="termDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="termSaving" @click="submitTerm">
          保存
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="translationDialogVisible"
      title="译名管理"
      width="min(920px, 96vw)"
      append-to-body
      destroy-on-close
    >
      <div v-if="activeTerm" class="source-post-term-translation-header">
        <div class="source-post-term-source-text">
          {{ activeTerm.sourceText }}
        </div>
        <el-button
          type="primary"
          size="small"
          @click="openCreateTranslationDialog"
        >
          <el-icon><Plus /></el-icon>
          新增译名
        </el-button>
      </div>
      <ResponsiveTable
        v-loading="translationLoading"
        :data="translationList"
        row-key="_id"
        border
      >
        <ResponsiveTableColumn label="语言" width="150">
          <template #default="{ row }">
            {{ getLanguageText(row.languageCode) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="译名" min-width="220">
          <template #default="{ row }">
            <div class="source-post-term-source-text">
              {{ row.translatedText }}
            </div>
            <div v-if="row.note" class="source-post-term-note">
              {{ row.note }}
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="来源" width="150">
          <template #default="{ row }">
            <el-tag effect="plain">
              {{ getTranslationSourceText(row.translationSource) }}
            </el-tag>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="使用情况" width="170">
          <template #default="{ row }">
            <div class="source-post-term-usage">
              <div class="source-post-term-usage-count">
                {{ getCountText(row.usedCount) }} 次
              </div>
              <div class="source-post-term-usage-date">
                最后：{{ getLastUsedAtText(row.lastUsedAt) }}
              </div>
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEditTranslationDialog(row)">
              编辑
            </el-button>
            <el-button
              type="danger"
              size="small"
              @click="deleteTranslation(row)"
            >
              删除
            </el-button>
          </template>
        </ResponsiveTableColumn>
      </ResponsiveTable>
    </el-dialog>

    <el-dialog
      v-model="translationEditDialogVisible"
      :title="translationDialogTitle"
      width="min(620px, 96vw)"
      append-to-body
      destroy-on-close
    >
      <el-form
        :model="translationForm"
        label-width="120px"
        class="source-post-term-form"
      >
        <el-form-item label="语言" required>
          <el-select
            v-model="translationForm.languageCode"
            class="w_10"
            filterable
            :disabled="translationMode === 'edit'"
          >
            <el-option
              v-for="item in languageOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="译名" required>
          <el-input
            v-model="translationForm.translatedText"
            maxlength="300"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="translationForm.note" type="textarea" :rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="translationEditDialogVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="translationSaving"
          @click="submitTranslation"
        >
          保存
        </el-button>
      </template>
    </el-dialog>

    <SourcePostTermOrganizeDialog
      v-model="organizeDialogVisible"
      :source-post="sourcePost"
      @created="getTermList(false)"
    />
  </div>
</template>

<script>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh } from '@element-plus/icons-vue'
import { multilingualApi } from '@/api'
import { formatDate } from '@/utils/utils'
import {
  restoreListSessionParams,
  saveListSessionParams
} from '@/composables/useListSessionParams'
import {
  getLanguageText,
  getPostDisplayTitle,
  sortBySupportedLanguageOrder,
  SUPPORTED_LANGUAGE_OPTIONS
} from '@/utils/multilingual'
import ProperNounInternetSearchButton from '@/components/ProperNounInternetSearchButton.vue'
import SourcePostTermOrganizeDialog from './SourcePostTermOrganizeDialog.vue'

const TRANSLATION_SOURCE_TEXT_MAP = {
  manual: '手动维护',
  internetSearchAi: '联网检索',
  aiKnowledgeBase: 'AI知识库',
  imported: '导入'
}

const RELATION_SOURCE_TEXT_MAP = {
  manual: '手动关联',
  aiOrganize: '文章名词整理',
  translationWorkflow: '翻译工作流'
}

function getInitialTermForm() {
  return {
    id: '',
    sourceText: '',
    sourceLanguageCode: '',
    note: ''
  }
}

function getInitialTranslationForm() {
  return {
    id: '',
    termId: '',
    languageCode: 'zh-CN',
    translatedText: '',
    note: ''
  }
}

export default {
  name: 'SourcePostProperNounList',
  components: {
    Plus,
    Refresh,
    ProperNounInternetSearchButton,
    SourcePostTermOrganizeDialog
  },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const tableRef = ref(null)
    const loading = ref(false)
    const termList = ref([])
    const total = ref(0)
    const relationCount = ref(0)
    const sourcePost = ref(null)
    const selectedTermRows = ref([])
    const organizeDialogVisible = ref(false)
    const params = reactive({
      page: 1,
      limit: 20,
      keyword: '',
      languageCode: ''
    })

    const termDialogVisible = ref(false)
    const termSaving = ref(false)
    const termMode = ref('create')
    const termForm = reactive(getInitialTermForm())

    const translationDialogVisible = ref(false)
    const translationEditDialogVisible = ref(false)
    const translationLoading = ref(false)
    const translationSaving = ref(false)
    const translationMode = ref('create')
    const activeTerm = ref(null)
    const translationList = ref([])
    const translationForm = reactive(getInitialTranslationForm())

    const languageOptions = SUPPORTED_LANGUAGE_OPTIONS
    const sourceId = computed(() => {
      return String(route.query.sourceId || route.params.sourceId || '').trim()
    })
    const listSessionKey = computed(() => {
      return `${route.name}:${sourceId.value}`
    })
    const sourcePostTitle = computed(() => {
      const title = getPostDisplayTitle(sourcePost.value)
      if (title && title !== '-') {
        return title
      }
      return sourceId.value || '-'
    })
    const termDialogTitle = computed(() => {
      if (termMode.value === 'edit') {
        return '编辑名词'
      }
      return '新增名词'
    })
    const translationDialogTitle = computed(() => {
      if (translationMode.value === 'edit') {
        return '编辑译名'
      }
      return '新增译名'
    })
    const selectedTermIds = computed(() => {
      const idList = []
      selectedTermRows.value.forEach(row => {
        const id = String(row?._id || '')
        if (!id || idList.includes(id)) {
          return
        }
        idList.push(id)
      })
      return idList
    })
    const internetSearchDefaultLanguageCodes = computed(() => {
      if (params.languageCode) {
        return [params.languageCode]
      }
      return []
    })

    function assignReactive(target, source) {
      Object.keys(target).forEach(key => {
        target[key] = source[key]
      })
    }

    function restoreTermListParams() {
      assignReactive(params, {
        page: 1,
        limit: 20,
        keyword: '',
        languageCode: ''
      })
      restoreListSessionParams(route, params, [], listSessionKey.value)
    }

    function getRequestParams() {
      const requestParams = {
        sourceId: sourceId.value,
        page: params.page,
        limit: params.limit
      }
      if (params.keyword) {
        requestParams.keyword = params.keyword
      }
      if (params.languageCode) {
        requestParams.languageCode = params.languageCode
      }
      return requestParams
    }

    function getTermList(resetPage = false) {
      if (!sourceId.value) {
        return
      }
      if (resetPage === true) {
        clearTermSelection()
      }
      if (resetPage === true && params.page !== 1) {
        params.page = 1
        return
      }
      loading.value = true
      multilingualApi
        .getSourcePostProperNounTermList(getRequestParams(), true)
        .then(response => {
          const data = response.data.data || {}
          sourcePost.value = data.sourcePost || null
          termList.value = data.list || []
          total.value = data.total || 0
          relationCount.value = data.relationCount || 0
          tableRef.value?.scrollTo({ top: 0 })
          saveListSessionParams(route, params, listSessionKey.value)
        })
        .finally(() => {
          loading.value = false
        })
    }

    function resetTermForm() {
      assignReactive(termForm, getInitialTermForm())
    }

    function openCreateTermDialog() {
      resetTermForm()
      termMode.value = 'create'
      termDialogVisible.value = true
    }

    function openEditTermDialog(row) {
      resetTermForm()
      termMode.value = 'edit'
      assignReactive(termForm, {
        id: row._id,
        sourceText: row.sourceText || '',
        sourceLanguageCode: row.sourceLanguageCode || '',
        note: row.note || ''
      })
      termDialogVisible.value = true
    }

    function submitTerm() {
      termSaving.value = true
      let request = null
      if (termMode.value === 'edit') {
        request = multilingualApi.updateProperNounTerm({ ...termForm })
      } else {
        request = multilingualApi.createSourcePostProperNounTerm({
          ...termForm,
          sourceId: sourceId.value
        })
      }
      request
        .then(() => {
          ElMessage.success('名词已保存')
          termDialogVisible.value = false
          getTermList(false)
        })
        .finally(() => {
          termSaving.value = false
        })
    }

    async function unbindTerm(row) {
      const relationId = row.relation?._id
      if (!relationId) {
        ElMessage.warning('文章名词关联不存在')
        return
      }
      try {
        await ElMessageBox.confirm(
          `确认将“${row.sourceText}”与该文章解绑？`,
          '解绑名词',
          {
            type: 'warning',
            confirmButtonText: '解绑',
            cancelButtonText: '取消'
          }
        )
      } catch (error) {
        return
      }
      multilingualApi
        .unbindSourcePostProperNounTerm({ id: relationId }, true)
        .then(() => {
          ElMessage.success('名词已解绑')
          clearTermSelection()
          getTermList(false)
        })
    }

    async function deleteTerm(row) {
      try {
        await ElMessageBox.confirm(
          `确认删除“${row.sourceText}”及其所有译名？`,
          '删除名词',
          {
            type: 'warning',
            confirmButtonText: '删除',
            cancelButtonText: '取消'
          }
        )
      } catch (error) {
        return
      }
      multilingualApi.deleteProperNounTerm({ id: row._id }, true).then(() => {
        ElMessage.success('名词已删除')
        clearTermSelection()
        getTermList(false)
      })
    }

    function handleTermSelectionChange(selection) {
      if (!Array.isArray(selection)) {
        selectedTermRows.value = []
        return
      }
      selectedTermRows.value = selection
    }

    function clearTermSelection() {
      selectedTermRows.value = []
      tableRef.value?.clearSelection()
    }

    function openTranslationDialog(row) {
      activeTerm.value = row
      translationDialogVisible.value = true
      getTranslationList()
    }

    function getTranslationList() {
      if (!activeTerm.value) {
        return
      }
      translationLoading.value = true
      multilingualApi
        .getProperNounTranslationList({ termId: activeTerm.value._id }, true)
        .then(response => {
          const data = response.data.data || {}
          translationList.value = sortBySupportedLanguageOrder(
            data.list,
            item => item.languageCode
          )
        })
        .finally(() => {
          translationLoading.value = false
        })
    }

    function resetTranslationForm() {
      assignReactive(translationForm, getInitialTranslationForm())
      if (activeTerm.value) {
        translationForm.termId = activeTerm.value._id
      }
    }

    function openCreateTranslationDialog() {
      resetTranslationForm()
      translationMode.value = 'create'
      translationEditDialogVisible.value = true
    }

    function openEditTranslationDialog(row) {
      resetTranslationForm()
      translationMode.value = 'edit'
      assignReactive(translationForm, {
        id: row._id,
        termId: row.termId,
        languageCode: row.languageCode,
        translatedText: row.translatedText || '',
        note: row.note || ''
      })
      translationEditDialogVisible.value = true
    }

    function submitTranslation() {
      const requestData = { ...translationForm }
      translationSaving.value = true
      let request = null
      if (translationMode.value === 'edit') {
        request = multilingualApi.updateProperNounTranslation(requestData)
      } else {
        request = multilingualApi.createProperNounTranslation(requestData)
      }
      request
        .then(() => {
          ElMessage.success('译名已保存')
          translationEditDialogVisible.value = false
          getTranslationList()
          getTermList(false)
        })
        .finally(() => {
          translationSaving.value = false
        })
    }

    async function deleteTranslation(row) {
      try {
        await ElMessageBox.confirm(
          `确认删除“${getLanguageText(row.languageCode)}：${row.translatedText}”？`,
          '删除译名',
          {
            type: 'warning',
            confirmButtonText: '删除',
            cancelButtonText: '取消'
          }
        )
      } catch (error) {
        return
      }
      multilingualApi
        .deleteProperNounTranslation({ id: row._id }, true)
        .then(() => {
          ElMessage.success('译名已删除')
          getTranslationList()
          getTermList(false)
        })
    }

    function openOrganizeDialog() {
      organizeDialogVisible.value = true
    }

    function handleInternetSearchApplied() {
      getTermList(false)
      if (translationDialogVisible.value && activeTerm.value) {
        getTranslationList()
      }
    }

    function getRowTermIds(row) {
      if (!row?._id) {
        return []
      }
      return [row._id]
    }

    function goBack() {
      router.push({ name: 'SourcePostImport' })
    }

    function getTranslationSourceText(value) {
      return TRANSLATION_SOURCE_TEXT_MAP[value] || value || '未知'
    }

    function getRelationSourceText(value) {
      return RELATION_SOURCE_TEXT_MAP[value] || value || '关联'
    }

    function getCountText(value) {
      const count = Number(value || 0)
      if (!Number.isFinite(count) || count < 0) {
        return '0'
      }
      return String(Math.floor(count))
    }

    function getLastUsedAtText(value) {
      if (!value) {
        return '未使用'
      }
      return formatDate(value)
    }

    function getRelationUpdatedAtText(row) {
      const updatedAt = row?.relation?.updatedAt
      if (!updatedAt) {
        return '-'
      }
      return formatDate(updatedAt)
    }

    function getDisplayedTranslations(row) {
      let translations = []
      if (Array.isArray(row.translations)) {
        translations = row.translations
      }
      if (params.languageCode) {
        return sortBySupportedLanguageOrder(
          translations.filter(item => {
            return item.languageCode === params.languageCode
          }),
          item => item.languageCode
        )
      }
      return sortBySupportedLanguageOrder(
        translations,
        item => item.languageCode
      )
    }

    restoreTermListParams()

    watch(
      () => [params.page, params.limit],
      () => {
        getTermList(false)
      }
    )

    watch(
      () => sourceId.value,
      () => {
        restoreTermListParams()
        getTermList(false)
      }
    )

    onMounted(() => {
      getTermList(false)
    })

    return {
      activeTerm,
      deleteTerm,
      deleteTranslation,
      getCountText,
      getDisplayedTranslations,
      getLanguageText,
      getLastUsedAtText,
      getRelationSourceText,
      getRelationUpdatedAtText,
      getRowTermIds,
      getTermList,
      getTranslationList,
      getTranslationSourceText,
      goBack,
      handleInternetSearchApplied,
      handleTermSelectionChange,
      internetSearchDefaultLanguageCodes,
      languageOptions,
      loading,
      openCreateTermDialog,
      openCreateTranslationDialog,
      openEditTermDialog,
      openEditTranslationDialog,
      openOrganizeDialog,
      openTranslationDialog,
      organizeDialogVisible,
      params,
      relationCount,
      selectedTermIds,
      sourceId,
      sourcePost,
      sourcePostTitle,
      submitTerm,
      submitTranslation,
      tableRef,
      termDialogTitle,
      termDialogVisible,
      termForm,
      termList,
      termSaving,
      total,
      translationDialogTitle,
      translationDialogVisible,
      translationEditDialogVisible,
      translationForm,
      translationList,
      translationLoading,
      translationMode,
      translationSaving,
      unbindTerm
    }
  }
}
</script>

<style scoped>
.source-post-proper-noun-page {
  min-width: 0;
}

.source-post-term-header,
.source-post-term-header-actions,
.source-post-term-actions,
.source-post-term-action-buttons,
.source-post-term-row-actions,
.source-post-term-translation-header {
  align-items: center;
  display: flex;
  gap: 8px;
}

.source-post-term-header {
  justify-content: space-between;
}

.source-post-term-title-block {
  min-width: 0;
}

.source-post-term-title {
  color: var(--el-text-color-primary);
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
  word-break: break-word;
}

.source-post-term-meta,
.source-post-term-count,
.source-post-term-note,
.source-post-term-note-cell,
.source-post-term-usage-date {
  color: var(--el-text-color-secondary);
}

.source-post-term-meta {
  font-size: 12px;
  line-height: 1.6;
  margin-top: 4px;
}

.source-post-term-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.source-post-term-action-buttons,
.source-post-term-row-actions {
  flex-wrap: wrap;
}

.source-post-term-action-buttons :deep(.el-button + .el-button),
.source-post-term-row-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.source-post-term-count {
  font-size: 13px;
  line-height: 32px;
  white-space: nowrap;
}

.source-post-term-source-text {
  color: var(--el-text-color-primary);
  font-weight: 600;
  line-height: 1.5;
  word-break: break-word;
}

.source-post-term-note {
  font-size: 12px;
  line-height: 1.5;
  margin-top: 4px;
  white-space: pre-wrap;
  word-break: break-word;
}

.source-post-term-note-cell {
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.source-post-term-translation-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.source-post-term-translation-list :deep(.el-tag) {
  height: auto;
  line-height: 18px;
  padding: 2px 9px;
  white-space: normal;
}

.source-post-term-usage {
  line-height: 1.5;
}

.source-post-term-usage-count {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.source-post-term-usage-date {
  font-size: 12px;
  margin-top: 4px;
  word-break: break-word;
}

.source-post-term-translation-header {
  justify-content: space-between;
  margin-bottom: 14px;
}

.source-post-term-form {
  max-width: 560px;
}

@media (max-width: 767px) {
  .source-post-term-header,
  .source-post-term-header-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .source-post-term-header-actions :deep(.el-button) {
    margin-left: 0;
    width: 100%;
  }

  .common-top-search-form-body {
    float: none !important;
    width: 100%;
  }

  .source-post-term-actions {
    align-items: stretch;
    float: none !important;
    flex-direction: column;
    justify-content: flex-start;
    margin-top: 10px;
    width: 100%;
  }

  .source-post-term-action-buttons {
    justify-content: flex-end;
    width: 100%;
  }

  .source-post-term-search-form :deep(.el-form-item) {
    display: block;
    margin-right: 0;
    width: 100%;
  }

  .source-post-term-search-form :deep(.el-input),
  .source-post-term-search-form :deep(.el-select) {
    width: 100% !important;
  }

  .source-post-term-form {
    max-width: none;
  }

  .source-post-term-form :deep(.el-form-item) {
    display: block;
  }

  .source-post-term-form :deep(.el-form-item__label) {
    justify-content: flex-start;
    width: auto !important;
  }

  .source-post-term-form :deep(.el-form-item__content) {
    margin-left: 0 !important;
  }
}
</style>
