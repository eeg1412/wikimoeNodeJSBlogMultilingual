<template>
  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="min(920px, 96vw)"
    align-center
    append-to-body
    destroy-on-close
    :before-close="handleBeforeClose"
  >
    <div class="proper-noun-internet-search">
      <template v-if="!searched">
        <el-form
          :model="form"
          label-width="120px"
          class="proper-noun-internet-search-form"
          @submit.prevent
        >
          <el-form-item label="检索范围">
            <div class="proper-noun-internet-search-scope">
              {{ scopeText }}
            </div>
          </el-form-item>
          <el-form-item label="目标语言" required>
            <el-checkbox-group
              v-model="form.targetLanguageCodes"
              class="proper-noun-internet-search-language-checks"
            >
              <el-checkbox
                v-for="item in languageOptions"
                :key="item.value"
                :value="item.value"
              >
                {{ item.label }}
              </el-checkbox>
            </el-checkbox-group>
          </el-form-item>
        </el-form>

        <div
          v-if="streamStatusList.length > 0"
          class="proper-noun-internet-search-feedback"
        >
          <div class="proper-noun-internet-search-feedback-title">实时反馈</div>
          <div
            v-for="item in streamStatusList"
            :key="item.id"
            class="proper-noun-internet-search-status-item"
          >
            {{ item.message }}
          </div>
        </div>
      </template>

      <template v-else>
        <el-alert
          v-if="resultSummary"
          class="proper-noun-internet-search-summary"
          type="info"
          :closable="false"
          show-icon
        >
          <template #title>{{ resultSummary }}</template>
        </el-alert>

        <ResponsiveTable
          v-if="previewRows.length > 0"
          class="proper-noun-internet-search-result"
          :data="previewRows"
          row-key="key"
          border
        >
          <ResponsiveTableColumn label="应用" width="80">
            <template #default="{ row }">
              <el-checkbox v-model="row.selected" />
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn label="原文名词" min-width="220">
            <template #default="{ row }">
              <div class="proper-noun-internet-search-source">
                {{ row.sourceText }}
              </div>
              <div v-if="row.note" class="proper-noun-internet-search-note">
                {{ row.note }}
              </div>
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn label="语言" width="150">
            <template #default="{ row }">
              {{ getLanguageText(row.languageCode) }}
            </template>
          </ResponsiveTableColumn>
          <ResponsiveTableColumn label="联网检索译名" min-width="240">
            <template #default="{ row }">
              <div class="proper-noun-internet-search-translation">
                {{ row.translatedText }}
              </div>
              <div
                v-if="row.translationNote"
                class="proper-noun-internet-search-translation-note"
              >
                译名备注：{{ row.translationNote }}
              </div>
              <el-tag
                v-if="row.shouldUpdateTermNote"
                size="small"
                type="warning"
                effect="plain"
              >
                更新备注
              </el-tag>
            </template>
          </ResponsiveTableColumn>
        </ResponsiveTable>
        <el-empty v-else description="联网搜索没有返回可应用的译名" />
      </template>
    </div>
    <template #footer>
      <el-button :disabled="searching || applying" @click="closeDialog">
        取消
      </el-button>
      <el-button v-if="searching" type="warning" @click="stopSearch">
        停止翻译
      </el-button>
      <el-button
        v-if="searched"
        :loading="searching"
        :disabled="applying || searching"
        @click="searchTranslations"
      >
        重新联网搜索
      </el-button>
      <el-button
        v-else
        type="primary"
        :loading="searching"
        :disabled="applying || searching"
        @click="searchTranslations"
      >
        联网搜索
      </el-button>
      <el-button
        v-if="searched"
        type="primary"
        :loading="applying"
        :disabled="selectedRows.length === 0 || searching"
        @click="applySelectedTranslations"
      >
        应用选中译名 {{ selectedRows.length }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { multilingualApi } from '@/api'
import store from '@/store'
import {
  createApiErrorFromResponse,
  extractApiErrorMessages
} from '@/utils/apiError'
import { isAbortError, readClientSseStream } from '@/utils/clientSse'
import {
  SUPPORTED_LANGUAGE_OPTIONS,
  getLanguageText
} from '@/utils/multilingual'

function normalizeString(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  return String(value).trim()
}

function normalizeLanguageCodes(values) {
  const languageCodes = []
  if (!Array.isArray(values)) {
    return languageCodes
  }
  const supportedValues = SUPPORTED_LANGUAGE_OPTIONS.map(item => item.value)
  values.forEach(value => {
    const languageCode = normalizeString(value)
    if (!supportedValues.includes(languageCode)) {
      return
    }
    if (!languageCodes.includes(languageCode)) {
      languageCodes.push(languageCode)
    }
  })
  return languageCodes
}

function buildPreviewRows(terms) {
  const rows = []
  if (!Array.isArray(terms)) {
    return rows
  }
  terms.forEach(term => {
    const translations = term?.translations || {}
    const translationNotes = term?.translationNotes || {}
    Object.keys(translations).forEach(languageCode => {
      const translatedText = normalizeString(translations[languageCode])
      if (!translatedText) {
        return
      }
      rows.push({
        key: `${term.termId || term.sourceText}:${languageCode}`,
        selected: true,
        termId: term.termId || '',
        sourceText: term.sourceText || '',
        languageCode,
        translatedText,
        note: term.note || '',
        translationNote: normalizeString(translationNotes[languageCode]),
        shouldUpdateTermNote: term.shouldUpdateTermNote === true,
        searchMetadata: term.searchMetadata || {}
      })
    })
  })
  return rows
}

function buildApplyTerms(rows) {
  const termMap = new Map()
  rows.forEach(row => {
    const termKey = row.termId || row.sourceText
    if (!termKey) {
      return
    }
    let term = termMap.get(termKey)
    if (!term) {
      term = {
        termId: row.termId,
        sourceText: row.sourceText,
        note: row.note,
        shouldUpdateTermNote: row.shouldUpdateTermNote === true,
        translationSource: 'internetSearchAi',
        translations: {},
        translationNotes: {},
        searchMetadata: row.searchMetadata || {}
      }
      termMap.set(termKey, term)
    }
    term.translations[row.languageCode] = row.translatedText
    if (row.translationNote) {
      term.translationNotes[row.languageCode] = row.translationNote
    }
    if (row.shouldUpdateTermNote === true) {
      term.shouldUpdateTermNote = true
      term.note = row.note
    }
  })
  return Array.from(termMap.values())
}

export default {
  name: 'ProperNounInternetSearchDialog',
  props: {
    modelValue: {
      type: Boolean,
      default: false
    },
    title: {
      type: String,
      default: '联网搜索译名'
    },
    sourceId: {
      type: String,
      default: ''
    },
    sourceLanguageCode: {
      type: String,
      default: ''
    },
    termIds: {
      type: Array,
      default() {
        return []
      }
    },
    defaultLanguageCodes: {
      type: Array,
      default() {
        return []
      }
    }
  },
  emits: ['update:modelValue', 'applied'],
  setup(props, { emit }) {
    const searching = ref(false)
    const applying = ref(false)
    const searched = ref(false)
    const previewRows = ref([])
    const provider = ref('')
    const model = ref('')
    const stats = ref(null)
    const streamStatusList = ref([])
    const abortController = ref(null)
    let streamStatusId = 0
    const form = reactive({
      targetLanguageCodes: []
    })

    const dialogVisible = computed({
      get() {
        return props.modelValue
      },
      set(value) {
        emit('update:modelValue', value)
      }
    })

    const languageOptions = SUPPORTED_LANGUAGE_OPTIONS
    const selectedRows = computed(() => {
      return previewRows.value.filter(row => row.selected === true)
    })
    const scopeText = computed(() => {
      if (props.termIds.length > 0) {
        return `指定名词 ${props.termIds.length} 个`
      }
      if (props.sourceId) {
        return '当前文章已关联名词'
      }
      return '未选择名词'
    })
    const resultSummary = computed(() => {
      if (!stats.value) {
        return ''
      }
      const parts = [
        `请求名词 ${stats.value.requestedTermCount || 0} 个`,
        `返回译名 ${previewRows.value.length} 个`
      ]
      if (stats.value.truncated === true) {
        parts.push(`已按上限 ${stats.value.maxCount} 个名词检索`)
      }
      return parts.join('，')
    })
    const dialogTitle = computed(() => {
      if (searched.value) {
        return '确认联网检索译名'
      }
      return props.title
    })

    function resetDialog() {
      form.targetLanguageCodes = normalizeLanguageCodes(
        props.defaultLanguageCodes
      )
      searching.value = false
      applying.value = false
      searched.value = false
      previewRows.value = []
      provider.value = ''
      model.value = ''
      stats.value = null
      streamStatusList.value = []
      abortController.value = null
    }

    function closeDialog() {
      dialogVisible.value = false
    }

    function pushStreamStatus(message) {
      const text = normalizeString(message)
      if (!text) {
        return
      }
      streamStatusId += 1
      streamStatusList.value.push({
        id: streamStatusId,
        message: text
      })
      if (streamStatusList.value.length > 60) {
        streamStatusList.value = streamStatusList.value.slice(-60)
      }
    }

    function stopSearch(showMessage = true) {
      if (!abortController.value) {
        return
      }
      abortController.value.abort()
      abortController.value = null
      pushStreamStatus('已请求停止翻译，正在中断任务...')
      if (showMessage) {
        ElMessage.info('已停止 AI 翻译')
      }
    }

    function handleStreamEvent(eventData, resultRef) {
      if (!eventData) {
        return
      }
      const data = eventData.data || {}
      if (eventData.eventName === 'status') {
        pushStreamStatus(data.message)
      }
      if (eventData.eventName === 'result') {
        resultRef.data = data
      }
      if (eventData.eventName === 'done') {
        pushStreamStatus('联网检索结果已返回')
      }
      if (eventData.eventName === 'error') {
        throw new Error(data.message || '联网检索失败')
      }
    }

    function handleBeforeClose(done) {
      if (searching.value) {
        return
      }
      done()
    }

    async function requestInternetSearchStream(targetLanguageCodes) {
      const controller = new AbortController()
      abortController.value = controller
      const response = await fetch(
        '/api/multilingual-admin/proper-noun/internet-search-stream',
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${store.getters.adminToken}`
          },
          body: JSON.stringify({
            sourceId: props.sourceId,
            sourceLanguageCode: props.sourceLanguageCode,
            termIds: props.termIds,
            targetLanguageCodes
          })
        }
      )

      if (!response.ok) {
        throw await createApiErrorFromResponse(response, '联网检索请求失败')
      }

      const resultRef = { data: null }
      await readClientSseStream(response, eventData => {
        handleStreamEvent(eventData, resultRef)
      })
      if (!resultRef.data) {
        throw new Error('联网检索没有返回结果')
      }
      return resultRef.data
    }

    async function searchTranslations() {
      const targetLanguageCodes = normalizeLanguageCodes(
        form.targetLanguageCodes
      )
      if (targetLanguageCodes.length === 0) {
        ElMessage.warning('请选择目标语言')
        return
      }
      searching.value = true
      searched.value = false
      previewRows.value = []
      stats.value = null
      streamStatusList.value = []
      try {
        pushStreamStatus('正在开始联网检索')
        const data = await requestInternetSearchStream(targetLanguageCodes)
        provider.value = data.provider || ''
        model.value = data.model || ''
        stats.value = data.stats || null
        previewRows.value = buildPreviewRows(data.terms || [])
        searched.value = true
        if (previewRows.value.length === 0) {
          ElMessage.warning('联网搜索没有返回可应用的译名')
        }
      } catch (error) {
        if (isAbortError(error)) {
          return
        }
        extractApiErrorMessages(error).forEach(message => {
          ElMessage.error(message)
        })
      } finally {
        abortController.value = null
        searching.value = false
      }
    }

    async function applySelectedTranslations() {
      const terms = buildApplyTerms(selectedRows.value)
      if (terms.length === 0) {
        ElMessage.warning('请选择需要应用的译名')
        return
      }
      applying.value = true
      try {
        const response =
          await multilingualApi.applyProperNounInternetTranslations(
            {
              provider: provider.value,
              model: model.value,
              terms
            },
            true
          )
        const data = response.data.data || {}
        ElMessage.success(`已应用 ${data.savedCount || 0} 个联网检索译名`)
        emit('applied', data)
        closeDialog()
      } finally {
        applying.value = false
      }
    }

    watch(
      () => props.modelValue,
      value => {
        if (value === true) {
          resetDialog()
        }
      }
    )

    return {
      applying,
      closeDialog,
      dialogVisible,
      dialogTitle,
      form,
      getLanguageText,
      handleBeforeClose,
      languageOptions,
      previewRows,
      resultSummary,
      scopeText,
      searched,
      searching,
      searchTranslations,
      selectedRows,
      stopSearch,
      streamStatusList,
      applySelectedTranslations
    }
  }
}
</script>

<style scoped>
.proper-noun-internet-search {
  min-width: 0;
}

.proper-noun-internet-search-form {
  max-width: 560px;
}

.proper-noun-internet-search-language-checks {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  line-height: 1.6;
}

.proper-noun-internet-search-language-checks :deep(.el-checkbox) {
  margin-right: 0;
}

.proper-noun-internet-search-scope {
  color: var(--el-text-color-secondary);
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.proper-noun-internet-search-feedback {
  margin-top: 16px;
  padding: 14px;
  max-height: 260px;
  overflow-y: auto;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-lighter);
}

.proper-noun-internet-search-feedback-title {
  color: var(--el-text-color-primary);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.6;
  margin-bottom: 4px;
}

.proper-noun-internet-search-status-item {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.proper-noun-internet-search-summary {
  margin-top: 12px;
  margin-bottom: 12px;
}

.proper-noun-internet-search-result {
  margin-top: 12px;
}

.proper-noun-internet-search-source,
.proper-noun-internet-search-translation {
  color: var(--el-text-color-primary);
  font-weight: 600;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.proper-noun-internet-search-note,
.proper-noun-internet-search-translation-note {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
  margin-top: 4px;
  overflow-wrap: anywhere;
}

@media (max-width: 767px) {
  .proper-noun-internet-search-form {
    max-width: none;
  }

  .proper-noun-internet-search-form :deep(.el-form-item) {
    display: block;
  }

  .proper-noun-internet-search-form :deep(.el-form-item__label) {
    justify-content: flex-start;
    width: auto !important;
  }

  .proper-noun-internet-search-form :deep(.el-form-item__content) {
    margin-left: 0 !important;
  }
}
</style>
