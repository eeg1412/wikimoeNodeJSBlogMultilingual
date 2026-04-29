<template>
  <el-dialog
    v-model="visible"
    :title="title"
    width="min(980px, 96vw)"
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
            <div class="cGray666">已选择 {{ selectedEntryIds.length }} 项</div>
            <div class="translation-json-toolbar-actions">
              <el-button size="small" :disabled="isBusy" @click="selectAll">
                全选
              </el-button>
              <el-button size="small" :disabled="isBusy" @click="clearAll">
                清空
              </el-button>
            </div>
          </div>

          <el-checkbox-group
            v-model="selectedEntryIds"
            class="w_10"
            :disabled="isBusy"
          >
            <div
              v-for="group in entryGroups"
              :key="group.label"
              class="translation-json-group"
            >
              <div class="translation-json-group-title">{{ group.label }}</div>
              <div class="translation-json-entry-list">
                <el-checkbox
                  v-for="entry in group.entries"
                  :key="entry.id"
                  :label="entry.id"
                  class="translation-json-entry"
                >
                  <div class="translation-json-entry-label">
                    {{ entry.label }}
                  </div>
                  <div class="translation-json-entry-preview">
                    {{ entry.previewText }}
                  </div>
                </el-checkbox>
              </div>
            </div>
          </el-checkbox-group>

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
              {{ item.label }}
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
import { getLanguageText } from '@/utils/multilingual'
import { renderRichTextDocument } from '@/utils/translationJson'

function groupEntryList(entryList) {
  const groupMap = new Map()
  entryList.forEach(entry => {
    const groupLabel = entry.groupLabel || '未分组'
    if (!groupMap.has(groupLabel)) {
      groupMap.set(groupLabel, [])
    }
    groupMap.get(groupLabel).push(entry)
  })

  return Array.from(groupMap.entries()).map(([label, entries]) => {
    return { label, entries }
  })
}

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
    const entryList = ref([])
    const currentEntryList = ref([])
    const selectedEntryIds = ref([])
    const prompt = ref('')
    const preview = ref(null)
    const streamStatusList = ref([])
    const streamContent = ref('')
    let entryLoadRequestId = 0

    const visible = computed({
      get() {
        return props.modelValue
      },
      set(value) {
        emit('update:modelValue', value)
      }
    })

    const entryGroups = computed(() => groupEntryList(entryList.value))
    const isBusy = computed(() => {
      return loading.value || translating.value || applying.value
    })
    const currentTargetLanguageCode = computed(() => props.targetLanguageCode)
    const requestSourceLanguageCode = computed(() => {
      if (baseMode.value === 'current') {
        return props.targetLanguageCode
      }
      return props.sourceLanguageCode
    })

    function resetState() {
      baseMode.value = 'source'
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
        let sourceResult = currentResult
        if (requestMode === 'source') {
          sourceResult = await props.loadSourceEntries(currentEntryList.value)
        }
        if (
          requestId !== entryLoadRequestId ||
          requestMode !== baseMode.value
        ) {
          return
        }
        entryList.value = sourceResult.entries || []
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
          label: currentEntry.label,
          fieldName: currentEntry.fieldName,
          valueType: currentEntry.valueType,
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
      const selectedIdSet = new Set(selectedEntryIds.value)
      const selectedEntries = entryList.value.filter(entry => {
        return selectedIdSet.has(entry.id)
      })
      resetPreview()
      translating.value = true
      try {
        pushStatus('正在开始翻译')
        const response = await fetch(
          '/api/multilingual-admin/translation/ai/translate-stream',
          {
            method: 'POST',
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
          throw new Error(`AI 翻译请求失败：${response.status}`)
        }
        await readStream(response)
      } catch (error) {
        ElMessage.error(error?.message || 'AI 翻译失败')
      } finally {
        translating.value = false
      }
    }

    async function confirmApply() {
      if (!preview.value || preview.value.changeList.length === 0) {
        ElMessage.warning('请先完成 AI 翻译预览')
        return
      }
      const payload = {}
      preview.value.changeList.forEach(item => {
        payload[item.fieldName] = item.finalValue
      })
      applying.value = true
      const finish = () => {
        applying.value = false
      }
      emit('confirm', payload, finish)
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
      isBusy,
      loading,
      preview,
      prompt,
      reloadEntries,
      requestSourceLanguageCode,
      requestTranslation,
      resetPreview,
      selectAll,
      selectedEntryIds,
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

.translation-json-group,
.translation-import-preview-item,
.translation-json-warning-list {
  margin-bottom: 18px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  padding: 14px;
  background: var(--el-fill-color-lighter);
}

.translation-json-group-title {
  font-weight: 600;
  margin-bottom: 8px;
}

.translation-json-entry-list {
  display: grid;
  gap: 10px;
}

.translation-json-entry {
  width: 100%;
  margin-right: 0;
  align-items: flex-start;
}

.translation-json-entry :deep(.el-checkbox__label) {
  width: 100%;
}

.translation-json-entry-label {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.translation-json-entry-preview,
.translation-json-warning-item,
.ai-stream-status-item {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.translation-import-preview-item {
  background: var(--el-bg-color);
  border-color: var(--el-border-color-lighter);
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

  .translation-json-toolbar-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}
</style>
