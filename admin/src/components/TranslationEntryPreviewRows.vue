<template>
  <div class="translation-entry-preview-rows" :style="previewGridStyle">
    <div v-if="hasCurrentContent" class="translation-entry-preview-row">
      <div class="translation-entry-preview-label">{{ currentLabel }}</div>
      <div
        v-if="currentHtml"
        class="translation-entry-preview-value translation-import-preview-html"
        v-html="currentHtml"
      />
      <pre
        v-else
        class="translation-entry-preview-value translation-import-preview-raw"
        >{{ currentText }}</pre
      >
    </div>
    <div v-if="hasSourceContent" class="translation-entry-preview-row">
      <div class="translation-entry-preview-label">{{ sourceLabel }}</div>
      <div
        v-if="sourceHtml"
        class="translation-entry-preview-value translation-import-preview-html"
        v-html="sourceHtml"
      />
      <pre
        v-else
        class="translation-entry-preview-value translation-import-preview-raw"
        >{{ sourceText }}</pre
      >
    </div>
    <div v-if="hasNextContent" class="translation-entry-preview-row">
      <div class="translation-entry-preview-label">{{ nextLabel }}</div>
      <div
        v-if="nextHtml"
        class="translation-entry-preview-value translation-import-preview-html"
        v-html="nextHtml"
      />
      <pre
        v-else
        class="translation-entry-preview-value translation-import-preview-raw"
        >{{ nextText }}</pre
      >
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { renderRichTextDocument } from '@/utils/translationJson'

const LEGACY_RICH_TEXT_VALUE_TYPE = 'richTextLite'
const STRUCTURED_RICH_TEXT_VALUE_TYPE = 'richTextDocument'

function normalizePreviewText(value) {
  if (value === null || value === undefined) {
    return ''
  }

  return String(value).trim()
}

function isRichTextEntry(entry) {
  if (entry?.valueType === LEGACY_RICH_TEXT_VALUE_TYPE) {
    return true
  }
  return entry?.valueType === STRUCTURED_RICH_TEXT_VALUE_TYPE
}

function parseRichTextDocumentValue(value) {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'object') {
    return value
  }

  const text = normalizePreviewText(value)
  if (!text) {
    return null
  }

  try {
    const parsedValue = JSON.parse(text)
    if (parsedValue && typeof parsedValue === 'object') {
      return parsedValue
    }
  } catch {
    return null
  }

  return null
}

function renderRichTextDocumentPreview(value) {
  const documentValue = parseRichTextDocumentValue(value)
  if (!documentValue) {
    return ''
  }

  try {
    return normalizePreviewText(renderRichTextDocument(documentValue))
  } catch {
    return ''
  }
}

function getPreviewHtml(entry, explicitHtml, rawValueList) {
  const html = normalizePreviewText(explicitHtml)
  if (html) {
    return html
  }

  if (entry?.valueType === LEGACY_RICH_TEXT_VALUE_TYPE) {
    return getFirstPreviewText(rawValueList)
  }

  if (entry?.valueType !== STRUCTURED_RICH_TEXT_VALUE_TYPE) {
    return ''
  }

  for (const rawValue of rawValueList) {
    const renderedHtml = renderRichTextDocumentPreview(rawValue)
    if (renderedHtml) {
      return renderedHtml
    }
  }

  return ''
}

function getFirstPreviewText(valueList) {
  if (!Array.isArray(valueList)) {
    return ''
  }

  for (const value of valueList) {
    const text = normalizePreviewText(value)
    if (text) {
      return text
    }
  }

  return ''
}

function getFullPreviewText(entry, rawValue, previewText) {
  if (isRichTextEntry(entry)) {
    return normalizePreviewText(previewText)
  }

  const fullText = normalizePreviewText(rawValue)
  if (fullText) {
    return fullText
  }

  return normalizePreviewText(previewText)
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
      return getFullPreviewText(
        props.entry,
        props.entry.currentPreviewRawValue,
        props.entry.currentPreviewText
      )
    })
    const currentHtml = computed(() => {
      return getPreviewHtml(props.entry, props.entry.currentPreviewHtml, [
        props.entry.currentPreviewRawValue,
        props.entry.currentValue,
        props.entry.targetValueSnapshotAtCompletion
      ])
    })
    const sourceText = computed(() => {
      return getFullPreviewText(
        props.entry,
        props.entry.sourcePreviewRawValue,
        props.entry.sourcePreviewText
      )
    })
    const sourceHtml = computed(() => {
      return getPreviewHtml(props.entry, props.entry.sourcePreviewHtml, [
        props.entry.sourcePreviewRawValue,
        props.entry.sourceValue
      ])
    })
    const nextText = computed(() => {
      const rawValue =
        props.entry.nextPreviewRawValue || props.entry.previewRawValue
      const previewText = props.entry.nextPreviewText || props.entry.previewText
      return getFullPreviewText(props.entry, rawValue, previewText)
    })
    const nextHtml = computed(() => {
      return getPreviewHtml(props.entry, props.entry.nextPreviewHtml, [
        props.entry.nextPreviewRawValue,
        props.entry.previewRawValue,
        props.entry.value
      ])
    })
    const hasCurrentContent = computed(() => {
      if (currentHtml.value) {
        return true
      }
      return currentText.value !== ''
    })
    const hasSourceContent = computed(() => {
      if (sourceHtml.value) {
        return true
      }
      return sourceText.value !== ''
    })
    const hasNextContent = computed(() => {
      if (nextHtml.value) {
        return true
      }
      return nextText.value !== ''
    })
    const visibleColumnCount = computed(() => {
      let count = 0
      if (hasCurrentContent.value) {
        count += 1
      }
      if (hasSourceContent.value) {
        count += 1
      }
      if (hasNextContent.value) {
        count += 1
      }
      if (count <= 0) {
        return 1
      }
      return count
    })
    const previewGridStyle = computed(() => {
      return {
        '--preview-columns': String(visibleColumnCount.value)
      }
    })

    return {
      currentLabel: props.currentLabel,
      currentHtml,
      currentText,
      hasCurrentContent,
      hasNextContent,
      hasSourceContent,
      nextLabel: props.nextLabel,
      nextHtml,
      nextText,
      previewGridStyle,
      sourceLabel: props.sourceLabel,
      sourceHtml,
      sourceText
    }
  }
}
</script>

<style scoped>
.translation-entry-preview-rows {
  margin-top: 8px;
  display: grid;
  grid-template-columns: repeat(var(--preview-columns, 3), minmax(0, 1fr));
  gap: 8px;
}

.translation-entry-preview-row {
  min-width: 0;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 10px;
  background: var(--el-bg-color-page);
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
  word-break: break-word;
}

.translation-import-preview-html,
.translation-import-preview-raw {
  padding: 10px;
  border-radius: 6px;
  background: var(--el-fill-color-light);
  border: 1px solid var(--el-border-color-lighter);
  overflow: auto;
  word-break: break-word;
}

.translation-import-preview-html {
  margin-bottom: 0;
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.7;
  white-space: normal;
}

.translation-import-preview-raw {
  margin: 0;
  max-height: 220px;
  white-space: pre-wrap;
  overflow: auto;
  font-family: Consolas, 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
}

.translation-import-preview-html :deep(:not(.w-e-image-group-img-body) > img),
.translation-import-preview-html
  :deep(:not(.w-e-image-group-img-body) > video) {
  max-width: 100%;
  height: auto;
}

@media (max-width: 767px) {
  .translation-entry-preview-rows {
    grid-template-columns: 1fr;
  }
}
</style>
