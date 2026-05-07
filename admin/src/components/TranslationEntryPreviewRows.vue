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
    const currentHtml = computed(() => {
      return normalizePreviewText(props.entry.currentPreviewHtml)
    })
    const sourceText = computed(() => {
      return normalizePreviewText(props.entry.sourcePreviewText)
    })
    const sourceHtml = computed(() => {
      return normalizePreviewText(props.entry.sourcePreviewHtml)
    })
    const nextText = computed(() => {
      return normalizePreviewText(props.entry.nextPreviewText)
    })
    const nextHtml = computed(() => {
      return normalizePreviewText(props.entry.nextPreviewHtml)
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
