<template>
  <div class="common-right-panel-form proper-noun-page">
    <div class="pb20">
      <el-breadcrumb separator="/">
        <el-breadcrumb-item>多语言数据管理</el-breadcrumb-item>
        <el-breadcrumb-item>专有名词翻译库</el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="clearfix pb20">
      <div class="fl common-top-search-form-body">
        <el-form
          :inline="true"
          :model="params"
          class="proper-noun-search-form"
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
            <el-select
              v-model="params.isStarred"
              placeholder="标星状态"
              clearable
              style="width: 130px"
            >
              <el-option label="已标星" value="true" />
              <el-option label="未标星" value="false" />
            </el-select>
          </el-form-item>
          <!--
          <el-form-item>
            <el-select
              v-model="params.enabled"
              placeholder="状态"
              clearable
              style="width: 120px"
            >
              <el-option label="启用" value="true" />
              <el-option label="停用" value="false" />
            </el-select>
          </el-form-item>
          -->
          <el-form-item>
            <el-button
              class="proper-noun-search-button"
              type="primary"
              @click="getTermList(true)"
            >
              搜索
            </el-button>
          </el-form-item>
        </el-form>
      </div>
      <div class="fr proper-noun-actions">
        <div class="proper-noun-limit-summary">
          专有名词 {{ termLimitText }}，标星 {{ starLimitText }}
        </div>
        <div class="proper-noun-action-buttons">
          <ProperNounInternetSearchButton
            button-text="联网检索"
            :term-ids="selectedTermIds"
            :default-language-codes="internetSearchDefaultLanguageCodes"
            :count="selectedTermIds.length"
            :disabled="selectedTermIds.length === 0"
            title="联网检索名词译名"
            @applied="handleInternetSearchApplied"
          />
          <el-button
            class="proper-noun-batch-delete-button"
            type="danger"
            :disabled="selectedTermIds.length === 0"
            :loading="batchDeleting"
            @click="deleteSelectedTerms"
          >
            批量删除
            <span v-if="selectedTermIds.length > 0">
              {{ selectedTermIds.length }}
            </span>
          </el-button>
          <el-button
            class="proper-noun-refresh-button"
            @click="getTermList(true)"
          >
            <el-icon><Refresh /></el-icon>
          </el-button>
          <el-button
            class="proper-noun-create-button"
            type="primary"
            @click="openCreateTermDialog"
          >
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
        <ResponsiveTableColumn label="标星" width="84" align="center">
          <template #default="{ row }">
            <ProperNounStarButton
              :is-starred="isTermStarred(row)"
              :loading="starUpdatingId === row._id"
              :disabled="Boolean(starUpdatingId) && starUpdatingId !== row._id"
              @click="toggleTermStar(row)"
            />
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="原文名词" min-width="240">
          <template #default="{ row }">
            <div class="proper-noun-source-text">{{ row.sourceText }}</div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="原文语言" width="140">
          <template #default="{ row }">
            <span>{{ getSourceLanguageText(row.sourceLanguageCode) }}</span>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="译名" min-width="260">
          <template #default="{ row }">
            <div
              v-if="getDisplayedTranslationItems(row).length > 0"
              class="proper-noun-translation-list"
            >
              <el-tag
                v-for="translation in getDisplayedTranslationItems(row)"
                :key="translation.displayKey"
                :type="getTranslationTagType(translation)"
                effect="plain"
              >
                {{ getTranslationTagText(translation) }}
              </el-tag>
            </div>
            <span v-else class="table-empty-text">暂无译名</span>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="备注" min-width="200">
          <template #default="{ row }">
            <div v-if="row.note" class="proper-noun-note-cell">
              {{ row.note }}
            </div>
            <span v-else class="table-empty-text">-</span>
          </template>
        </ResponsiveTableColumn>
        <!--
        <ResponsiveTableColumn label="状态" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.enabled" type="success" effect="plain">
              启用
            </el-tag>
            <el-tag v-else type="info" effect="plain">停用</el-tag>
          </template>
        </ResponsiveTableColumn>
        -->
        <ResponsiveTableColumn label="使用情况" width="180">
          <template #default="{ row }">
            <div class="proper-noun-usage">
              <div class="proper-noun-usage-count">
                {{ getUsedCountText(row.usedCount) }} 次
              </div>
              <div class="proper-noun-usage-date">
                最后：{{ getLastUsedAtText(row.lastUsedAt) }}
              </div>
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="更新时间" width="180">
          <template #default="{ row }">
            {{ row.updatedAt ? $formatDate(row.updatedAt) : '-' }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <div class="proper-noun-row-actions">
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
      <el-form :model="termForm" label-width="120px" class="proper-noun-form">
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
        <!--
        <el-form-item label="启用">
          <el-switch v-model="termForm.enabled" />
        </el-form-item>
        -->
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
      align-center
      destroy-on-close
    >
      <div v-if="activeTerm" class="proper-noun-translation-header">
        <div class="proper-noun-source-text">{{ activeTerm.sourceText }}</div>
        <el-button
          type="primary"
          size="small"
          @click="openCreateTranslationDialog()"
        >
          <el-icon><Plus /></el-icon>
          新增译名
        </el-button>
      </div>
      <ResponsiveTable
        v-loading="translationLoading"
        :data="translationDisplayList"
        row-key="_id"
        border
      >
        <ResponsiveTableColumn label="语言" width="150">
          <template #default="{ row }">
            {{ row.languageLabel || getLanguageText(row.languageCode) }}
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="译名" min-width="220">
          <template #default="{ row }">
            <el-tag
              v-if="row.isMissingTranslation"
              type="danger"
              effect="plain"
            >
              缺少译名
            </el-tag>
            <template v-else>
              <div class="proper-noun-source-text">
                {{ row.translatedText }}
              </div>
              <div v-if="row.note" class="proper-noun-note">
                {{ row.note }}
              </div>
            </template>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="来源" width="150">
          <template #default="{ row }">
            <span v-if="row.isMissingTranslation" class="table-empty-text">
              -
            </span>
            <el-tag v-else effect="plain">{{
              getTranslationSourceText(row.translationSource)
            }}</el-tag>
          </template>
        </ResponsiveTableColumn>
        <!--
        <ResponsiveTableColumn label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.enabled" type="success" effect="plain"
              >启用</el-tag
            >
            <el-tag v-else type="info" effect="plain">停用</el-tag>
          </template>
        </ResponsiveTableColumn>
        -->
        <ResponsiveTableColumn label="使用情况" width="170">
          <template #default="{ row }">
            <span v-if="row.isMissingTranslation" class="table-empty-text">
              -
            </span>
            <div v-else class="proper-noun-usage">
              <div class="proper-noun-usage-count">
                {{ getUsedCountText(row.usedCount) }} 次
              </div>
              <div class="proper-noun-usage-date">
                最后：{{ getLastUsedAtText(row.lastUsedAt) }}
              </div>
            </div>
          </template>
        </ResponsiveTableColumn>
        <ResponsiveTableColumn label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.isMissingTranslation"
              type="primary"
              size="small"
              @click="openCreateTranslationDialog(row.languageCode)"
            >
              添加译名
            </el-button>
            <template v-else>
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
        class="proper-noun-form"
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
        <!--
        <el-form-item label="启用">
          <el-switch v-model="translationForm.enabled" />
        </el-form-item>
        -->
        <el-form-item label="备注">
          <el-input v-model="translationForm.note" type="textarea" :rows="4" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="translationEditDialogVisible = false"
          >取消</el-button
        >
        <el-button
          type="primary"
          :loading="translationSaving"
          @click="submitTranslation"
        >
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
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
  SUPPORTED_LANGUAGE_OPTIONS
} from '@/utils/multilingual'
import { buildProperNounTranslationDisplayItems } from '@/utils/properNounTranslation'
import ProperNounInternetSearchButton from '@/components/ProperNounInternetSearchButton.vue'
import ProperNounStarButton from '@/components/ProperNounStarButton.vue'

const TRANSLATION_SOURCE_TEXT_MAP = {
  manual: '手动维护',
  internetSearchAi: '联网检索',
  aiKnowledgeBase: 'AI知识库',
  imported: '导入'
}

function getInitialTermForm() {
  return {
    id: '',
    sourceText: '',
    sourceLanguageCode: '',
    note: ''
    // enabled: true
  }
}

function getInitialTranslationForm() {
  return {
    id: '',
    termId: '',
    languageCode: 'zh-CN',
    translatedText: '',
    note: ''
    // enabled: true
  }
}

export default {
  name: 'ProperNounTranslationList',
  components: {
    ProperNounInternetSearchButton,
    ProperNounStarButton,
    Plus,
    Refresh
  },
  setup() {
    const route = useRoute()
    const tableRef = ref(null)
    const loading = ref(false)
    const batchDeleting = ref(false)
    const starUpdatingId = ref('')
    const termList = ref([])
    const total = ref(0)
    const selectedTermRows = ref([])
    const termSummary = reactive({
      count: 0,
      maxCount: 0,
      starredCount: 0,
      maxStarredCount: 0
    })
    const params = reactive({
      page: 1,
      limit: 20,
      keyword: '',
      languageCode: '',
      isStarred: ''
      // enabled: ''
    })
    restoreListSessionParams(route, params)

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
    const termLimitText = computed(() => {
      const count = getCountText(termSummary.count)
      const maxCount = getCountText(termSummary.maxCount)
      if (maxCount === '0') {
        return `${count}/-`
      }
      return `${count}/${maxCount}`
    })
    const starLimitText = computed(() => {
      const count = getCountText(termSummary.starredCount)
      const maxCount = getCountText(termSummary.maxStarredCount)
      if (maxCount === '0') {
        return `${count}/-`
      }
      return `${count}/${maxCount}`
    })
    const internetSearchDefaultLanguageCodes = computed(() => {
      if (params.languageCode) {
        return [params.languageCode]
      }
      return []
    })
    const translationDisplayList = computed(() => {
      return buildProperNounTranslationDisplayItems({
        translations: translationList.value,
        languageOptions,
        sourceLanguageCode: activeTerm.value?.sourceLanguageCode
      })
    })

    function assignReactive(target, source) {
      Object.keys(target).forEach(key => {
        target[key] = source[key]
      })
    }

    function getTermRequestParams() {
      const requestParams = {
        page: params.page,
        limit: params.limit
      }
      if (params.keyword) {
        requestParams.keyword = params.keyword
      }
      if (params.languageCode) {
        requestParams.languageCode = params.languageCode
      }
      if (params.isStarred !== '') {
        requestParams.isStarred = params.isStarred
      }
      /*
      if (params.enabled !== '') {
        requestParams.enabled = params.enabled
      }
      */
      return requestParams
    }

    function getTermList(resetPage = false) {
      if (resetPage === true) {
        clearTermSelection()
      }
      if (resetPage === true && params.page !== 1) {
        params.page = 1
        return
      }
      loading.value = true
      multilingualApi
        .getProperNounTermList(getTermRequestParams(), true)
        .then(response => {
          const data = response.data.data || {}
          termList.value = data.list || []
          total.value = data.total || 0
          termSummary.count = data.termCount || 0
          termSummary.maxCount = data.maxTermCount || 0
          termSummary.starredCount = data.starredTermCount || 0
          termSummary.maxStarredCount = data.maxStarredTermCount || 0
          saveListSessionParams(route, params)
        })
        .finally(() => {
          loading.value = false
        })
    }

    function preserveTableScrollForNextRefresh() {
      tableRef.value?.preserveScrollOnNextDataRefresh()
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
        // enabled: row.enabled !== false
      })
      termDialogVisible.value = true
    }

    function submitTerm() {
      const requestData = { ...termForm }
      termSaving.value = true
      let request = null
      if (termMode.value === 'edit') {
        request = multilingualApi.updateProperNounTerm(requestData)
      } else {
        request = multilingualApi.createProperNounTerm(requestData)
      }
      request
        .then(() => {
          ElMessage.success('名词已保存')
          termDialogVisible.value = false
          if (termMode.value === 'edit') {
            preserveTableScrollForNextRefresh()
          }
          getTermList()
        })
        .finally(() => {
          termSaving.value = false
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
      multilingualApi.deleteProperNounTerm({ id: row._id }).then(() => {
        ElMessage.success('名词已删除')
        clearTermSelection()
        getTermList()
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

    function isTermStarred(row) {
      return row?.isStarred === true
    }

    async function toggleTermStar(row) {
      const id = String(row?._id || '')
      if (!id || starUpdatingId.value) {
        return
      }

      const isStarred = !isTermStarred(row)
      starUpdatingId.value = id
      try {
        const response = await multilingualApi.updateProperNounTermStar(
          { id, isStarred },
          true
        )
        const data = response.data.data || {}
        const term = data.term || {}
        row.isStarred = term.isStarred === true
        if (typeof data.starredTermCount === 'number') {
          termSummary.starredCount = data.starredTermCount
        }
        if (typeof data.maxStarredTermCount === 'number') {
          termSummary.maxStarredCount = data.maxStarredTermCount
        }
        ElMessage.success(isStarred ? '名词已标星' : '名词已取消标星')
        if (params.isStarred !== '') {
          getTermList(false)
        }
      } finally {
        starUpdatingId.value = ''
      }
    }

    async function deleteSelectedTerms() {
      const ids = selectedTermIds.value
      if (ids.length === 0) {
        return
      }

      try {
        await ElMessageBox.confirm(
          `确认删除选中的 ${ids.length} 个专有名词及其所有译名？`,
          '批量删除',
          {
            type: 'warning',
            confirmButtonText: '删除',
            cancelButtonText: '取消'
          }
        )
      } catch (error) {
        return
      }

      batchDeleting.value = true
      try {
        const response = await multilingualApi.batchDeleteProperNounTerms(
          { ids },
          true
        )
        const data = response.data.data || {}
        let deletedCount = ids.length
        if (typeof data.deletedCount === 'number') {
          deletedCount = data.deletedCount
        }
        ElMessage.success(`已删除 ${deletedCount} 个专有名词`)
        clearTermSelection()
        getTermList()
      } catch (error) {
        console.log(error)
      } finally {
        batchDeleting.value = false
      }
    }

    function handleInternetSearchApplied() {
      preserveTableScrollForNextRefresh()
      getTermList()
      if (translationDialogVisible.value && activeTerm.value) {
        getTranslationList()
      }
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
          translationList.value = data.list || []
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

    function openCreateTranslationDialog(languageCode = '') {
      resetTranslationForm()
      translationMode.value = 'create'
      let selectedLanguageCode = ''
      if (typeof languageCode === 'string') {
        selectedLanguageCode = languageCode.trim()
      }
      if (selectedLanguageCode) {
        translationForm.languageCode = selectedLanguageCode
      }
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
        // enabled: row.enabled !== false
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
          if (translationMode.value === 'edit') {
            preserveTableScrollForNextRefresh()
          }
          getTermList()
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
      multilingualApi.deleteProperNounTranslation({ id: row._id }).then(() => {
        ElMessage.success('译名已删除')
        getTranslationList()
        getTermList()
      })
    }

    function getTranslationSourceText(value) {
      return TRANSLATION_SOURCE_TEXT_MAP[value] || value || '未知'
    }

    function getUsedCountText(value) {
      return getCountText(value)
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

    function getDisplayedTranslationItems(row) {
      return buildProperNounTranslationDisplayItems({
        translations: row?.translations,
        languageOptions,
        selectedLanguageCode: params.languageCode,
        sourceLanguageCode: row?.sourceLanguageCode
      })
    }

    function getSourceLanguageText(sourceLanguageCode) {
      if (!sourceLanguageCode) {
        return '-'
      }
      const languageText = getLanguageText(sourceLanguageCode)
      if (!languageText || languageText === sourceLanguageCode) {
        return sourceLanguageCode
      }
      return `${languageText}（${sourceLanguageCode}）`
    }

    function getTranslationTagType(translation) {
      if (translation?.isMissingTranslation) {
        return 'danger'
      }
      return 'primary'
    }

    function getTranslationTagText(translation) {
      const languageText =
        translation?.languageLabel || getLanguageText(translation?.languageCode)
      if (translation?.isMissingTranslation) {
        return `${languageText}：缺少译名`
      }
      return `${languageText}：${translation?.translatedText || ''}`
    }

    watch(
      () => [params.page, params.limit],
      () => {
        getTermList()
      }
    )

    onMounted(() => {
      getTermList()
    })

    return {
      Plus,
      Refresh,
      activeTerm,
      batchDeleting,
      deleteTerm,
      deleteSelectedTerms,
      deleteTranslation,
      getDisplayedTranslationItems,
      getLastUsedAtText,
      getLanguageText,
      getSourceLanguageText,
      getTermList,
      getTranslationList,
      getTranslationSourceText,
      getTranslationTagText,
      getTranslationTagType,
      getUsedCountText,
      handleInternetSearchApplied,
      handleTermSelectionChange,
      internetSearchDefaultLanguageCodes,
      isTermStarred,
      languageOptions,
      loading,
      openCreateTermDialog,
      openCreateTranslationDialog,
      openEditTermDialog,
      openEditTranslationDialog,
      openTranslationDialog,
      params,
      selectedTermIds,
      starLimitText,
      starUpdatingId,
      submitTerm,
      submitTranslation,
      tableRef,
      termDialogTitle,
      termDialogVisible,
      termForm,
      termLimitText,
      termList,
      termSaving,
      total,
      translationDialogTitle,
      translationDialogVisible,
      translationDisplayList,
      translationEditDialogVisible,
      translationForm,
      translationList,
      translationLoading,
      translationMode,
      translationSaving,
      toggleTermStar
    }
  }
}
</script>

<style scoped>
.proper-noun-page {
  min-width: 0;
}

.proper-noun-actions,
.proper-noun-row-actions,
.proper-noun-translation-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.proper-noun-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
  max-width: 100%;
  min-width: 0;
}

.proper-noun-action-buttons {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  max-width: 100%;
  min-width: 0;
}

.proper-noun-action-buttons :deep(.el-button + .el-button),
.proper-noun-row-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.proper-noun-limit-summary {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 32px;
  max-width: 100%;
  white-space: nowrap;
}

.proper-noun-row-actions {
  flex-wrap: wrap;
}

.proper-noun-source-text {
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.5;
  word-break: break-word;
}

.proper-noun-note {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.proper-noun-note-cell {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.proper-noun-translation-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.proper-noun-translation-list :deep(.el-tag) {
  white-space: normal;
  height: auto;
  line-height: 18px;
  padding: 2px 9px;
}

.proper-noun-usage {
  line-height: 1.5;
}

.proper-noun-usage-count {
  color: var(--el-text-color-primary);
  font-weight: 600;
}

.proper-noun-usage-date {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  word-break: break-word;
}

.proper-noun-translation-header {
  justify-content: space-between;
  margin-bottom: 14px;
}

.proper-noun-form {
  max-width: 560px;
}

@media (max-width: 767px) {
  .common-top-search-form-body {
    float: none !important;
    width: 100%;
  }

  .proper-noun-actions {
    display: flex;
    flex-direction: column;
    float: none !important;
    justify-content: flex-start;
    align-items: stretch;
    margin-top: 10px;
    width: 100%;
  }

  .proper-noun-action-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: flex-end;
    width: 100%;
  }

  .proper-noun-search-form :deep(.el-form-item) {
    display: block;
    margin-right: 0;
    width: 100%;
  }

  .proper-noun-search-form :deep(.el-input),
  .proper-noun-search-form :deep(.el-select) {
    width: 100% !important;
  }

  .proper-noun-search-button {
    width: 100%;
  }

  .proper-noun-limit-summary {
    line-height: 1.5;
    text-align: left;
    white-space: normal;
  }

  .proper-noun-action-buttons :deep(.el-button) {
    flex-shrink: 0;
    margin-left: 0;
    width: auto;
  }

  .proper-noun-batch-delete-button,
  .proper-noun-create-button {
    max-width: 100%;
  }

  .proper-noun-refresh-button {
    align-items: center;
    display: inline-flex;
    justify-content: center;
    min-width: 44px;
    width: 44px;
    min-height: 32px;
    padding-left: 0;
    padding-right: 0;
  }

  .proper-noun-form {
    max-width: none;
  }

  .proper-noun-form :deep(.el-form-item) {
    display: block;
  }

  .proper-noun-form :deep(.el-form-item__label) {
    width: auto !important;
    justify-content: flex-start;
  }

  .proper-noun-form :deep(.el-form-item__content) {
    margin-left: 0 !important;
  }
}
</style>
