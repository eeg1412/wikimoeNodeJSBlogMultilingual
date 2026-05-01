<template>
  <el-dialog
    v-model="visible"
    :title="title"
    width="min(980px, 96vw)"
    align-center
    destroy-on-close
    append-to-body
    :show-close="!isBusy"
    :close-on-click-modal="!isBusy"
    :close-on-press-escape="!isBusy"
  >
    <div v-loading="applying" element-loading-text="正在写入，请稍候">
      <el-skeleton v-if="loading" :rows="8" animated />
      <template v-else>
        <el-descriptions class="mb20" :column="3" border>
          <el-descriptions-item label="源语言">
            {{ getLanguageText(requestSourceLanguageCode) }}
          </el-descriptions-item>
          <el-descriptions-item label="目标语言">
            {{ getLanguageText(targetLanguageCode) }}
          </el-descriptions-item>
          <el-descriptions-item label="可翻译条目">
            {{ entryList.length }}
          </el-descriptions-item>
        </el-descriptions>

        <template v-if="!preview">
          <el-form class="translation-json-option-form" label-width="110px">
            <el-form-item label="源语言">
              <el-select
                v-model="selectedSourceLanguageCode"
                class="w_10"
                :disabled="isBusy"
                filterable
                placeholder="请选择源语言"
                @change="handleSourceLanguageChange"
              >
                <el-option
                  v-for="option in languageOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="翻译用内容">
              <el-radio-group
                v-model="baseMode"
                :disabled="isBusy"
                @change="reloadEntries"
              >
                <el-radio value="source">源快照</el-radio>
                <el-radio value="current">当前内容</el-radio>
              </el-radio-group>
            </el-form-item>
          </el-form>

          <div class="translation-json-toolbar">
            <div class="translation-dialog-intro">
              <div class="translation-dialog-intro-title">选择 AI 翻译字段</div>
              <div class="translation-dialog-intro-text">
                已选择
                {{ selectedEntryIds.length }}
                项。按分组检查字段，卡片会直接显示所属对象与字段类型。
              </div>
            </div>
            <div class="translation-json-toolbar-actions">
              <el-button size="small" :disabled="isBusy" @click="selectAll">
                全选
              </el-button>
              <el-button size="small" :disabled="isBusy" @click="clearAll">
                清空
              </el-button>
            </div>
          </div>

          <TranslationEntrySelectableGroups
            v-model="selectedEntryIds"
            :groups="entryGroups"
            class="w_10"
            :disabled="isBusy"
          />

          <el-form class="ai-translation-prompt-form" label-width="110px">
            <el-form-item label="此次提示词">
              <el-input
                v-model="prompt"
                type="textarea"
                :rows="5"
                :disabled="isBusy"
                placeholder="可补充本次翻译的语气、专有名词、保留词或风格要求"
              />
            </el-form-item>
          </el-form>

          <div
            v-if="streamStatusList.length > 0 || streamContent"
            class="ai-stream-feedback"
          >
            <div class="translation-json-group-title">实时反馈</div>
            <div
              v-for="item in streamStatusList"
              :key="item.id"
              class="ai-stream-status-item"
            >
              {{ item.message }}
            </div>
            <pre v-if="streamContent" class="ai-stream-content">{{
              streamContent
            }}</pre>
          </div>
        </template>

        <div v-else class="translation-import-preview-section">
          <el-alert
            class="mb20"
            type="warning"
            show-icon
            :closable="false"
            title="确认写入后，会立即保存当前内容。"
          />
          <el-descriptions class="mb20" :column="2" border>
            <el-descriptions-item label="可写入变更">
              {{ preview.changeList.length }}
            </el-descriptions-item>
            <el-descriptions-item label="跳过条目">
              {{ preview.warningList.length }}
            </el-descriptions-item>
          </el-descriptions>
          <div
            v-if="preview.warningList.length"
            class="translation-json-warning-list"
          >
            <div class="translation-json-group-title">跳过说明</div>
            <div
              v-for="warning in preview.warningList"
              :key="warning"
              class="translation-json-warning-item"
            >
              {{ warning }}
            </div>
          </div>
          <div
            v-for="item in preview.changeList"
            :key="item.id"
            class="translation-import-preview-item"
          >
            <div class="translation-import-preview-item-title">
              <TranslationEntryMeta :entry="item" />
            </div>
            <div class="translation-import-preview-columns">
              <div class="translation-import-preview-panel">
                <div class="translation-import-preview-panel-title">当前</div>
                <pre class="translation-import-preview-raw">{{
                  item.currentValue
                }}</pre>
              </div>
              <div class="translation-import-preview-panel">
                <div class="translation-import-preview-panel-title">翻译后</div>
                <pre class="translation-import-preview-raw">{{
                  item.nextValue
                }}</pre>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <template #footer>
      <el-button :disabled="isBusy" @click="visible = false">取消</el-button>
      <el-button v-if="translating" type="warning" @click="stopTranslation">
        停止翻译
      </el-button>
      <el-button v-if="preview" :disabled="isBusy" @click="resetPreview">
        返回调整
      </el-button>
      <el-button
        v-if="!preview"
        type="primary"
        :loading="translating"
        :disabled="isBusy || entryList.length === 0"
        @click="requestTranslation"
      >
        开始翻译
      </el-button>
      <el-button
        v-else
        type="primary"
        :loading="applying"
        :disabled="isBusy || preview.changeList.length === 0"
        @click="confirmApply"
      >
        确认写入
      </el-button>
    </template>
  </el-dialog>
</template>

<script>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import store from '@/store'
import TranslationEntryMeta from '@/components/TranslationEntryMeta.vue'
import TranslationEntrySelectableGroups from '@/components/TranslationEntrySelectableGroups.vue'
import {
  getLanguageText,
  SUPPORTED_LANGUAGE_OPTIONS
} from '@/utils/multilingual'
import {
  createApiErrorFromResponse,
  extractApiErrorMessages
} from '@/utils/apiError'
import { groupTranslationEntryList } from '@/utils/translationEntryDisplay'
import { renderRichTextDocument } from '@/utils/translationJson'

function stringifyValue(valueType, value) {
  if (valueType === 'richTextDocument') {
    return JSON.stringify(value, null, 2)
  }
  return String(value || '')
}

function comparableValue(valueType, value) {
  if (valueType === 'richTextDocument') {
    return JSON.stringify(value || {})
  }
  return String(value || '')
}

function toFinalValue(valueType, value) {
  if (valueType === 'richTextDocument') {
    return renderRichTextDocument(value)
  }
  return value
}

export default {
  name: 'ContentAiTranslationDialog',
  components: {
    TranslationEntryMeta,
    TranslationEntrySelectableGroups
  },
  props: {
    modelValue: { type: Boolean, default: false },
    title: { type: String, default: 'AI 翻译' },
    contentId: { type: String, default: '' },
    contentType: { type: String, default: 'content' },
    sourceLanguageCode: { type: String, default: '' },
    targetLanguageCode: { type: String, default: '' },
    snapshotVersion: { type: Number, default: 1 },
    loadSourceEntries: { type: Function, required: true },
    loadCurrentEntries: { type: Function, required: true }
  },
  emits: ['update:modelValue', 'confirm'],
  setup(props, { emit }) {
    const loading = ref(false)
    const translating = ref(false)
    const applying = ref(false)
    const baseMode = ref('source')
    const selectedSourceLanguageCode = ref('')
    const entryList = ref([])
    const currentEntryList = ref([])
    const selectedEntryIds = ref([])
    const prompt = ref('')
    const preview = ref(null)
    const streamStatusList = ref([])
    const streamContent = ref('')
    const activeAbortController = ref(null)
    let entryLoadRequestId = 0

    const visible = computed({
      get() {
        return props.modelValue
      },
      set(value) {
        emit('update:modelValue', value)
      }
    })

    const entryGroups = computed(() =>
      groupTranslationEntryList(entryList.value)
    )
    const isBusy = computed(() => {
      return loading.value || translating.value || applying.value
    })
    const currentTargetLanguageCode = computed(() => props.targetLanguageCode)
    const languageOptions = computed(() => SUPPORTED_LANGUAGE_OPTIONS)
    const requestSourceLanguageCode = computed(
      () => selectedSourceLanguageCode.value
    )

    function getDefaultSourceLanguageCode() {
      return props.sourceLanguageCode || ''
    }

    function resetState() {
      if (activeAbortController.value) {
        activeAbortController.value.abort()
        activeAbortController.value = null
      }
      baseMode.value = 'source'
      selectedSourceLanguageCode.value = getDefaultSourceLanguageCode()
      entryList.value = []
      currentEntryList.value = []
      selectedEntryIds.value = []
      prompt.value = ''
      preview.value = null
      streamStatusList.value = []
      streamContent.value = ''
    }

    function selectAll() {
      selectedEntryIds.value = entryList.value.map(entry => entry.id)
    }

    function clearAll() {
      selectedEntryIds.value = []
    }

    function resetPreview() {
      preview.value = null
      streamStatusList.value = []
      streamContent.value = ''
    }

    function handleSourceLanguageChange() {
      resetPreview()
      reloadEntries()
    }

    function attachEntryPreviewRows(entries, currentEntries, sourceEntries) {
      const currentEntryMap = new Map(
        currentEntries.map(entry => [entry.id, entry])
      )
      const sourceEntryMap = new Map(
        sourceEntries.map(entry => [entry.id, entry])
      )

      return entries.map(entry => {
        const currentEntry = currentEntryMap.get(entry.id)
        const sourceEntry = sourceEntryMap.get(entry.id)
        return {
          ...entry,
          currentPreviewText:
            currentEntry?.previewText || entry.currentPreviewText || '',
          currentPreviewRawValue:
            currentEntry?.previewRawValue || entry.currentPreviewRawValue || '',
          sourcePreviewText:
            sourceEntry?.previewText || entry.sourcePreviewText || '',
          sourcePreviewRawValue:
            sourceEntry?.previewRawValue || entry.sourcePreviewRawValue || ''
        }
      })
    }

    async function reloadEntries() {
      const requestId = entryLoadRequestId + 1
      entryLoadRequestId = requestId
      loading.value = true
      preview.value = null
      try {
        const requestMode = baseMode.value
        const currentResult = await props.loadCurrentEntries()
        if (
          requestId !== entryLoadRequestId ||
          requestMode !== baseMode.value
        ) {
          return
        }
        currentEntryList.value = currentResult.entries || []
        let sourceResult = { entries: [] }
        if (requestSourceLanguageCode.value) {
          sourceResult = await props.loadSourceEntries(
            currentEntryList.value,
            requestSourceLanguageCode.value
          )
        }
        if (
          requestId !== entryLoadRequestId ||
          requestMode !== baseMode.value
        ) {
          return
        }
        const sourceEntries = sourceResult.entries || []
        const baseEntries =
          requestMode === 'source' ? sourceEntries : currentEntryList.value
        entryList.value = attachEntryPreviewRows(
          baseEntries,
          currentEntryList.value,
          sourceEntries
        )
        selectedEntryIds.value = entryList.value
          .filter(entry => entry.defaultSelected)
          .map(entry => entry.id)
      } finally {
        if (requestId === entryLoadRequestId) {
          loading.value = false
        }
      }
    }

    function pushStatus(message) {
      if (!message) {
        return
      }
      streamStatusList.value.push({
        id: `${Date.now()}-${streamStatusList.value.length}`,
        message
      })
    }

    function isAbortError(error) {
      if (!error) {
        return false
      }
      if (error.name === 'AbortError') {
        return true
      }
      if (error.code === 'ABORT_ERR') {
        return true
      }
      return false
    }

    function stopTranslation() {
      if (!activeAbortController.value) {
        return
      }
      activeAbortController.value.abort()
      pushStatus('已停止翻译请求')
    }

    function parseSseBlock(block) {
      const eventData = { eventName: 'message', data: {} }
      const dataLines = []
      block.split(/\r?\n/).forEach(line => {
        if (line.startsWith('event:')) {
          eventData.eventName = line.slice(6).trim()
        }
        if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart())
        }
      })
      if (dataLines.length === 0) {
        return null
      }
      try {
        eventData.data = JSON.parse(dataLines.join('\n'))
      } catch (error) {
        eventData.data = {}
      }
      return eventData
    }

    function findSseBoundary(buffer) {
      const lfIndex = buffer.indexOf('\n\n')
      const crlfIndex = buffer.indexOf('\r\n\r\n')
      if (lfIndex < 0 && crlfIndex < 0) {
        return { index: -1, length: 0 }
      }
      if (lfIndex < 0) {
        return { index: crlfIndex, length: 4 }
      }
      if (crlfIndex < 0) {
        return { index: lfIndex, length: 2 }
      }
      if (lfIndex < crlfIndex) {
        return { index: lfIndex, length: 2 }
      }
      return { index: crlfIndex, length: 4 }
    }

    function buildPreview(payload) {
      const currentEntryMap = new Map(
        currentEntryList.value.map(entry => [entry.id, entry])
      )
      const changeList = []
      const warningList = []
      ;(payload.entries || []).forEach(entry => {
        const currentEntry = currentEntryMap.get(entry.id)
        if (!currentEntry) {
          warningList.push(`已跳过未知条目：${entry.label || entry.id}`)
          return
        }
        const nextValue = entry.value
        if (
          comparableValue(currentEntry.valueType, currentEntry.value) ===
          comparableValue(currentEntry.valueType, nextValue)
        ) {
          return
        }
        changeList.push({
          id: entry.id,
          scope: currentEntry.scope,
          label: currentEntry.label,
          fieldName: currentEntry.fieldName,
          fieldLabel: currentEntry.fieldLabel,
          valueType: currentEntry.valueType,
          collectionName: currentEntry.collectionName,
          recordId: currentEntry.recordId,
          recordLabel: currentEntry.recordLabel,
          relationTypeLabel: currentEntry.relationTypeLabel,
          currentValue: stringifyValue(
            currentEntry.valueType,
            currentEntry.value
          ),
          nextValue: stringifyValue(currentEntry.valueType, nextValue),
          finalValue: toFinalValue(currentEntry.valueType, nextValue)
        })
      })
      return { changeList, warningList }
    }

    function handleStreamEvent(eventData) {
      if (!eventData) {
        return null
      }
      const data = eventData.data || {}
      if (eventData.eventName === 'status') {
        pushStatus(data.message)
      }
      if (eventData.eventName === 'chunk') {
        if (data.contentDelta) {
          streamContent.value += data.contentDelta
        }
      }
      if (eventData.eventName === 'result') {
        preview.value = buildPreview(data.payload || {})
        if (preview.value.changeList.length === 0) {
          ElMessage.info('AI 返回结果中没有可写入的变更')
        }
      }
      if (eventData.eventName === 'error') {
        return new Error(data.message || 'AI 翻译失败')
      }
      return null
    }

    async function readStream(response) {
      if (!response.body) {
        throw new Error('浏览器不支持读取 AI 翻译流')
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''
      let streamError = null

      function consumeBuffer() {
        let boundary = findSseBoundary(buffer)
        while (boundary.index >= 0) {
          const block = buffer.slice(0, boundary.index)
          buffer = buffer.slice(boundary.index + boundary.length)
          const error = handleStreamEvent(parseSseBlock(block))
          if (error) {
            streamError = error
          }
          boundary = findSseBoundary(buffer)
        }
      }

      let done = false
      while (!done) {
        const result = await reader.read()
        done = result.done
        if (result.value) {
          buffer += decoder.decode(result.value, { stream: !done })
          consumeBuffer()
        }
      }
      if (buffer.trim()) {
        const error = handleStreamEvent(parseSseBlock(buffer))
        if (error) {
          streamError = error
        }
      }
      if (streamError) {
        throw streamError
      }
    }

    async function requestTranslation() {
      if (loading.value) {
        ElMessage.warning('正在加载翻译用内容，请稍候')
        return
      }
      if (selectedEntryIds.value.length === 0) {
        ElMessage.warning('请至少选择一项翻译内容')
        return
      }
      if (!requestSourceLanguageCode.value) {
        ElMessage.warning('请选择源语言')
        return
      }
      const selectedIdSet = new Set(selectedEntryIds.value)
      const selectedEntries = entryList.value.filter(entry => {
        return selectedIdSet.has(entry.id)
      })
      resetPreview()
      translating.value = true
      const abortController = new AbortController()
      activeAbortController.value = abortController
      try {
        pushStatus('正在开始翻译')
        const response = await fetch(
          '/api/multilingual-admin/translation/ai/translate-stream',
          {
            method: 'POST',
            signal: abortController.signal,
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${store.getters.adminToken}`
            },
            body: JSON.stringify({
              contentId: props.contentId,
              contentType: props.contentType,
              sourceLanguageCode: requestSourceLanguageCode.value,
              targetLanguageCode: props.targetLanguageCode,
              snapshotVersion: props.snapshotVersion,
              prompt: prompt.value,
              entries: selectedEntries
            })
          }
        )
        if (!response.ok) {
          throw await createApiErrorFromResponse(response, 'AI 翻译请求失败')
        }
        await readStream(response)
      } catch (error) {
        if (isAbortError(error)) {
          ElMessage.info('已停止 AI 翻译')
          return
        }
        extractApiErrorMessages(error).forEach(message => {
          ElMessage.error(message)
        })
      } finally {
        activeAbortController.value = null
        translating.value = false
      }
    }

    async function confirmApply() {
      if (!preview.value || preview.value.changeList.length === 0) {
        ElMessage.warning('请先完成 AI 翻译预览')
        return
      }
      const payload = {}
      const relationUpdateMap = new Map()
      preview.value.changeList.forEach(item => {
        if (item.scope === 'parentRelation') {
          const relationUpdateKey = `${item.collectionName}:${item.recordId}`
          if (!relationUpdateMap.has(relationUpdateKey)) {
            relationUpdateMap.set(relationUpdateKey, {
              collectionName: item.collectionName,
              id: item.recordId,
              payload: {}
            })
          }
          relationUpdateMap.get(relationUpdateKey).payload[item.fieldName] =
            item.finalValue
          return
        }
        payload[item.fieldName] = item.finalValue
      })
      const applyPlan = {
        payload,
        relationUpdates: Array.from(relationUpdateMap.values())
      }
      applying.value = true
      const finish = () => {
        applying.value = false
      }
      emit('confirm', payload, finish, applyPlan)
    }

    watch(
      () => props.modelValue,
      value => {
        if (!value) {
          return
        }
        resetState()
        reloadEntries()
      }
    )

    return {
      applying,
      baseMode,
      clearAll,
      confirmApply,
      entryGroups,
      entryList,
      getLanguageText,
      handleSourceLanguageChange,
      isBusy,
      languageOptions,
      loading,
      preview,
      prompt,
      reloadEntries,
      requestSourceLanguageCode,
      requestTranslation,
      stopTranslation,
      resetPreview,
      selectAll,
      selectedEntryIds,
      selectedSourceLanguageCode,
      streamContent,
      streamStatusList,
      targetLanguageCode: currentTargetLanguageCode,
      translating,
      visible
    }
  }
}
</script>

<style scoped>
.translation-json-toolbar,
.translation-json-toolbar-actions {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.translation-json-toolbar-actions {
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  margin-bottom: 0;
}

.translation-json-option-form {
  margin-bottom: 12px;
}

.translation-dialog-intro {
  min-width: 0;
}

.translation-dialog-intro-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.translation-dialog-intro-text {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.translation-json-group {
  margin-bottom: 18px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 14px;
  padding: 16px;
  background: var(--el-bg-color);
}

.translation-json-warning-list {
  margin-bottom: 18px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 14px;
  padding: 16px;
  background: var(--el-fill-color-extra-light);
}

.translation-json-group-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.translation-json-group-heading {
  flex: 1;
  min-width: 0;
}

.translation-json-group-eyebrow {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--el-color-primary);
}

.translation-json-group-title {
  font-weight: 600;
  display: flex;
  align-items: center;
  margin: 4px 0 0;
  min-height: 21px;
  font-size: 15px;
  line-height: 1.5;
  color: var(--el-text-color-primary);
}

.translation-json-group-count {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  padding: 4px 10px;
  min-height: 24px;
  color: var(--el-color-primary-dark-2);
  font-size: 12px;
  font-weight: 600;
}

.translation-json-entry-list {
  display: grid;
  gap: 0;
}

.translation-json-entry {
  width: 100%;
  margin-right: 0;
  align-items: flex-start;
  padding: 10px 0;
}

.translation-json-entry + .translation-json-entry {
  border-top: 1px dashed var(--el-border-color-lighter);
}

.translation-json-entry :deep(.el-checkbox__label) {
  width: 100%;
  padding-left: 12px;
}

.translation-json-entry :deep(.el-checkbox__input) {
  margin-top: 4px;
}

.translation-json-warning-item,
.ai-stream-status-item {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}

.translation-import-preview-item {
  margin-bottom: 18px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 14px;
  padding: 16px;
  background: var(--el-bg-color);
}

.translation-import-preview-item-title {
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px dashed var(--el-border-color-lighter);
}

.translation-import-preview-item + .translation-import-preview-item {
  margin-top: 12px;
}

.translation-import-preview-columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-top: 10px;
}

.translation-import-preview-panel {
  min-width: 0;
}

.translation-import-preview-panel-title {
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--el-text-color-secondary);
}

.translation-import-preview-raw,
.ai-stream-content {
  padding: 10px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  max-height: 220px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  color: var(--el-text-color-regular);
}

.ai-stream-feedback {
  margin-top: 16px;
  padding: 14px;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
  background: var(--el-fill-color-lighter);
}

@media (max-width: 767px) {
  .translation-json-toolbar,
  .translation-import-preview-columns {
    grid-template-columns: 1fr;
    display: grid;
  }

  .translation-json-group-header {
    flex-direction: column;
  }

  .translation-json-group-count {
    align-self: flex-start;
  }

  .translation-json-toolbar-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
