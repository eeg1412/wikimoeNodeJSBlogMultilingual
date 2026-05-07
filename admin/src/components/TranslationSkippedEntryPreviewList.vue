<template>
  <div class="translation-skipped-entry-preview-list">
    <div
      v-for="(item, index) in entries"
      :key="item.id || item.entryKey || index"
      class="translation-skip-preview-card"
    >
      <div class="translation-import-preview-item-title">
        <TranslationEntryMeta :entry="item" />
      </div>
      <div class="translation-skip-preview-columns">
        <div v-if="hasSourceValue(item)" class="translation-skip-preview-panel">
          <div class="translation-import-preview-panel-title">
            {{ sourceLabel }}
            <div
              v-if="
                item.sourceRecordLabel &&
                item.sourceRecordLabel !== item.recordLabel
              "
              class="translation-import-preview-panel-context"
            >
              {{ item.sourceRecordLabel }}
            </div>
          </div>
          <div
            v-if="getSourceHtml(item)"
            class="translation-import-preview-html"
            v-html="getSourceHtml(item)"
          />
          <pre
            v-if="!getSourceHtml(item)"
            class="translation-import-preview-raw"
            >{{ getSourceValue(item) }}</pre
          >
        </div>
        <div class="translation-skip-preview-panel">
          <div class="translation-import-preview-panel-title">
            {{ currentLabel }}
            <div
              v-if="
                item.targetRecordLabel &&
                item.targetRecordLabel !== item.recordLabel
              "
              class="translation-import-preview-panel-context"
            >
              {{ item.targetRecordLabel }}
            </div>
          </div>
          <template v-if="hasCurrentValue(item)">
            <div
              v-if="getCurrentHtml(item)"
              class="translation-import-preview-html"
              v-html="getCurrentHtml(item)"
            />
            <pre
              v-if="!getCurrentHtml(item)"
              class="translation-import-preview-raw"
              >{{ getCurrentValue(item) }}</pre
            >
          </template>
          <div v-else class="translation-import-preview-empty">
            不存在当前语言内容（未导入）
          </div>
        </div>
        <div class="translation-skip-preview-panel">
          <div class="translation-import-preview-panel-title">跳过说明</div>
          <div class="translation-skip-reason">
            {{ getReason(item) }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import TranslationEntryMeta from '@/components/TranslationEntryMeta.vue'

function normalizePreviewText(value) {
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  return String(value).trim()
}

export default {
  name: 'TranslationSkippedEntryPreviewList',
  components: {
    TranslationEntryMeta
  },
  props: {
    entries: {
      type: Array,
      default() {
        return []
      }
    },
    currentLabel: {
      type: String,
      default: '当前'
    },
    sourceLabel: {
      type: String,
      default: '源文'
    }
  },
  setup() {
    function getSourceHtml(item) {
      return normalizePreviewText(item.sourceHtml || item.sourcePreviewHtml)
    }

    function getCurrentHtml(item) {
      return normalizePreviewText(item.targetHtml || item.currentPreviewHtml)
    }

    function getSourceValue(item) {
      return normalizePreviewText(
        item.sourceValue || item.sourcePreviewRawValue || item.sourcePreviewText
      )
    }

    function getCurrentValue(item) {
      return normalizePreviewText(
        item.targetValue ||
          item.currentPreviewRawValue ||
          item.currentPreviewText
      )
    }

    function hasSourceValue(item) {
      if (item.hasSourceValue === false) {
        return false
      }
      return Boolean(getSourceHtml(item) || getSourceValue(item))
    }

    function hasCurrentValue(item) {
      if (item.hasCurrentValue === false) {
        return false
      }
      return Boolean(getCurrentHtml(item) || getCurrentValue(item))
    }

    function getReason(item) {
      return normalizePreviewText(
        item.reason || item.aiSkipReason || item.message || 'AI 已跳过'
      )
    }

    return {
      getCurrentHtml,
      getCurrentValue,
      getReason,
      getSourceHtml,
      getSourceValue,
      hasCurrentValue,
      hasSourceValue
    }
  }
}
</script>

<style scoped>
.translation-skip-preview-card {
  margin-bottom: 12px;
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: 8px;
  padding: 14px;
  background: var(--el-color-warning-light-9);
}

.translation-skip-preview-columns {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-top: 10px;
}

.translation-skip-preview-panel {
  min-width: 0;
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: 8px;
  padding: 12px;
  background: var(--el-bg-color);
}

.translation-import-preview-item-title {
  color: var(--el-text-color-primary);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.5;
  word-break: break-word;
}

.translation-import-preview-panel-title {
  margin-bottom: 8px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.5;
}

.translation-import-preview-panel-context {
  margin-top: 2px;
  color: var(--el-text-color-placeholder);
  font-weight: 400;
}

.translation-import-preview-empty {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.7;
}

.translation-import-preview-html,
.translation-import-preview-raw {
  overflow: auto;
  word-break: break-word;
}

.translation-import-preview-html {
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.6;
}

.translation-import-preview-raw {
  max-height: 260px;
  margin: 0;
  white-space: pre-wrap;
  color: var(--el-text-color-regular);
  font-size: 12px;
  line-height: 1.6;
}

.translation-import-preview-html :deep(:not(.w-e-image-group-img-body) > img),
.translation-import-preview-html
  :deep(:not(.w-e-image-group-img-body) > video) {
  max-width: 100%;
  height: auto;
}

.translation-skip-reason {
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: 1.7;
  word-break: break-word;
  white-space: pre-wrap;
}

@media (max-width: 767px) {
  .translation-skip-preview-columns {
    grid-template-columns: 1fr;
  }
}
</style>
