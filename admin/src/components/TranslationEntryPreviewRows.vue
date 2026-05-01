<template>
  <div class="translation-entry-preview-rows">
    <div v-if="hasCurrentContent" class="translation-entry-preview-row">
      <div class="translation-entry-preview-label">{{ currentLabel }}</div>
      <div class="translation-entry-preview-value">{{ currentText }}</div>
    </div>
    <div v-if="hasSourceContent" class="translation-entry-preview-row">
      <div class="translation-entry-preview-label">{{ sourceLabel }}</div>
      <div class="translation-entry-preview-value">{{ sourceText }}</div>
    </div>
    <div v-if="hasNextContent" class="translation-entry-preview-row">
      <div class="translation-entry-preview-label">{{ nextLabel }}</div>
      <div class="translation-entry-preview-value">{{ nextText }}</div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'

function normalizePreviewText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

export default {
  name: 'TranslationEntryPreviewRows',
  props: {
    entry: {
      type: Object,
      required: true
    },
    currentLabel: {
      type: String,
      default: '当前语言下的内容'
    },
    sourceLabel: {
      type: String,
      default: '源内容'
    },
    nextLabel: {
      type: String,
      default: '新内容'
    }
  },
  setup(props) {
    const currentText = computed(() => {
      return normalizePreviewText(props.entry.currentPreviewText)
    })
    const sourceText = computed(() => {
      return normalizePreviewText(props.entry.sourcePreviewText)
    })
    const nextText = computed(() => {
      return normalizePreviewText(props.entry.nextPreviewText)
    })
    const hasCurrentContent = computed(() => currentText.value !== '')
    const hasSourceContent = computed(() => sourceText.value !== '')
    const hasNextContent = computed(() => nextText.value !== '')

    return {
      currentLabel: props.currentLabel,
      currentText,
      hasCurrentContent,
      hasNextContent,
      hasSourceContent,
      nextLabel: props.nextLabel,
      nextText,
      sourceLabel: props.sourceLabel,
      sourceText
    }
  }
}
</script>

<style scoped>
.translation-entry-preview-rows {
  margin-top: 8px;
  display: grid;
  gap: 8px;
}

.translation-entry-preview-row {
  padding-left: 12px;
  border-left: 2px solid var(--el-border-color);
}

.translation-entry-preview-label {
  margin-bottom: 2px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
}

.translation-entry-preview-value {
  color: var(--el-text-color-regular);
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
