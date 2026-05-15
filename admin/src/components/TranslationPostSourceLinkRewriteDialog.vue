<template>
  <el-dialog
    v-model="visible"
    title="检查并替换源站链接"
    width="min(1120px, 96vw)"
    class="translation-source-link-rewrite-dialog"
    align-center
    append-to-body
    :close-on-click-modal="!isBusy"
    :close-on-press-escape="!isBusy"
  >
    <div v-loading="previewLoading" class="source-link-rewrite-body">
      <div class="source-link-rewrite-summary">
        <div>
          <div class="source-link-rewrite-title">
            选择需要替换的源站链接
          </div>
          <div class="source-link-rewrite-subtitle">
            已选择 {{ selectedFields.length }} /
            {{ allEntryKeys.length }} 条，检测到
            {{ preview.totalMatchCount || 0 }} 条链接
          </div>
        </div>
        <div class="source-link-rewrite-site-list">
          <el-tag type="info" effect="plain">
            源站域名：{{ preview.sourceSiteUrl || '-' }}
          </el-tag>
          <el-tag type="success" effect="plain">
            目标语言：{{ preview.languageCode || '-' }}
          </el-tag>
        </div>
      </div>

      <div class="source-link-rewrite-panel-actions">
        <el-button size="small" plain @click="selectAllFields">全选</el-button>
        <el-button size="small" plain @click="selectPostFields">
          只选文章内容
        </el-button>
        <el-button size="small" plain @click="clearSelectedFields">
          清空
        </el-button>
      </div>

      <el-empty
        v-if="!previewLoading && allEntryKeys.length === 0"
        description="未检测到需要替换的源站链接"
      />

      <el-checkbox-group
        v-else
        v-model="selectedFields"
        class="source-link-rewrite-preview-panel"
      >
        <section>
          <div
            v-for="group in preview.groups"
            :key="group.key"
            class="source-link-rewrite-preview-group"
          >
            <div class="source-link-rewrite-preview-group-title">
              <span>{{ group.label }}</span>
              <el-button size="small" text @click="toggleGroup(group)">
                {{ isGroupSelected(group) ? '取消本组' : '选择本组' }}
              </el-button>
            </div>

            <div class="source-link-rewrite-preview-list">
              <div
                v-for="entry in group.entries"
                :key="entry.key"
                class="source-link-rewrite-preview-item"
                :class="{ 'is-selected': selectedFieldSet.has(entry.key) }"
              >
                <div class="source-link-rewrite-preview-field-head">
                  <el-checkbox
                    :value="entry.key"
                    class="source-link-rewrite-card-checkbox"
                  >
                    <span>{{ entry.fieldLabel }}</span>
                    <el-tag size="small" type="warning" effect="plain">
                      {{ entry.occurrenceLabel }}
                    </el-tag>
                  </el-checkbox>
                </div>

                <div class="source-link-rewrite-entry-meta">
                  <el-tag size="small" effect="plain">
                    {{ entry.collectionLabel }}
                  </el-tag>
                  <span class="source-link-rewrite-record-label">
                    {{ entry.recordLabel }}
                  </span>
                  <span
                    v-if="entry.relationLabels && entry.relationLabels.length"
                    class="source-link-rewrite-relation-labels"
                  >
                    {{ entry.relationLabels.join('、') }}
                  </span>
                </div>

                <div class="source-link-rewrite-match-list">
                  <el-tag
                    v-for="match in entry.matches"
                    :key="`${entry.key}-${match.sourceUrl}`"
                    size="small"
                    type="info"
                    effect="plain"
                  >
                    {{ match.routeLabel }}
                  </el-tag>
                </div>

                <div class="source-link-rewrite-compare-grid">
                  <div class="source-link-rewrite-compare-cell">
                    <div class="source-link-rewrite-compare-label">当前</div>
                    <pre class="source-link-rewrite-compare-text"><template
                      v-for="(part, index) in entry.currentParts"
                      :key="`current-${entry.key}-${index}`"
                    ><mark
                      v-if="part.highlighted"
                      class="source-link-rewrite-highlight is-current"
                    >{{ part.text }}</mark><span v-else>{{ part.text }}</span></template></pre>
                  </div>
                  <div class="source-link-rewrite-compare-cell">
                    <div class="source-link-rewrite-compare-label">替换后</div>
                    <pre class="source-link-rewrite-compare-text"><template
                      v-for="(part, index) in entry.nextParts"
                      :key="`next-${entry.key}-${index}`"
                    ><mark
                      v-if="part.highlighted"
                      class="source-link-rewrite-highlight is-next"
                    >{{ part.text }}</mark><span v-else>{{ part.text }}</span></template></pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </el-checkbox-group>
    </div>

    <template #footer>
      <el-button :disabled="isBusy" @click="visible = false">取消</el-button>
      <el-button
        type="warning"
        :loading="applying"
        :disabled="previewLoading || selectedFields.length === 0"
        @click="applySelectedFields"
      >
        替换选中链接
      </el-button>
    </template>
  </el-dialog>
</template>

<script>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { multilingualApi } from '@/api'

function createEmptyPreview() {
  return {
    postId: '',
    languageCode: '',
    sourceSiteUrl: '',
    targetSiteUrl: '',
    groups: [],
    defaultSelectedKeys: [],
    totalFieldCount: 0,
    totalMatchCount: 0
  }
}

export default {
  name: 'TranslationPostSourceLinkRewriteDialog',
  props: {
    modelValue: { type: Boolean, default: false },
    postId: { type: String, default: '' },
    languageCode: { type: String, default: '' }
  },
  emits: ['update:modelValue', 'applied'],
  setup(props, { emit }) {
    const previewLoading = ref(false)
    const applying = ref(false)
    const selectedFields = ref([])
    const preview = reactive(createEmptyPreview())

    const visible = computed({
      get() {
        return props.modelValue
      },
      set(value) {
        emit('update:modelValue', value)
      }
    })

    const isBusy = computed(() => {
      return previewLoading.value || applying.value
    })

    const allEntryKeys = computed(() => {
      return preview.groups.flatMap(group => {
        return group.entries.map(entry => entry.key)
      })
    })

    const postEntryKeys = computed(() => {
      return preview.groups.flatMap(group => {
        return group.entries
          .filter(entry => {
            return entry.scope === 'post'
          })
          .map(entry => {
            return entry.key
          })
      })
    })

    const selectedFieldSet = computed(() => {
      return new Set(selectedFields.value)
    })

    function resetPreview(data) {
      Object.assign(preview, createEmptyPreview(), data || {})
      if (
        Array.isArray(preview.defaultSelectedKeys) &&
        preview.defaultSelectedKeys.length > 0
      ) {
        selectedFields.value = [...preview.defaultSelectedKeys]
        return
      }

      selectedFields.value = []
    }

    async function loadPreview() {
      if (!props.postId) {
        ElMessage.warning('当前语言版本缺少文章 ID')
        visible.value = false
        return
      }

      previewLoading.value = true
      try {
        const response =
          await multilingualApi.getTranslationPostSourceLinkPreview(
            {
              id: props.postId,
              languageCode: props.languageCode
            },
            true
          )
        resetPreview(response.data.data)
      } finally {
        previewLoading.value = false
      }
    }

    function selectAllFields() {
      selectedFields.value = [...allEntryKeys.value]
    }

    function selectPostFields() {
      selectedFields.value = [...postEntryKeys.value]
    }

    function clearSelectedFields() {
      selectedFields.value = []
    }

    function isGroupSelected(group) {
      const groupKeys = group.entries.map(entry => {
        return entry.key
      })
      return groupKeys.every(key => {
        return selectedFieldSet.value.has(key)
      })
    }

    function toggleGroup(group) {
      const groupKeys = group.entries.map(entry => {
        return entry.key
      })
      if (isGroupSelected(group)) {
        selectedFields.value = selectedFields.value.filter(key => {
          return !groupKeys.includes(key)
        })
        return
      }

      const nextSet = new Set(selectedFields.value)
      groupKeys.forEach(key => nextSet.add(key))
      selectedFields.value = Array.from(nextSet)
    }

    async function applySelectedFields() {
      if (selectedFields.value.length === 0) {
        ElMessage.warning('请选择至少一条源站链接')
        return
      }

      applying.value = true
      try {
        const response =
          await multilingualApi.applyTranslationPostSourceLinkReplacement({
            id: props.postId,
            languageCode: props.languageCode,
            selectedKeys: selectedFields.value
          })
        ElMessage.success('已替换选中的源站链接')
        emit('applied', response.data.data)
        visible.value = false
      } finally {
        applying.value = false
      }
    }

    watch(
      () => props.modelValue,
      value => {
        if (value) {
          loadPreview()
        }
      }
    )

    return {
      allEntryKeys,
      applying,
      applySelectedFields,
      clearSelectedFields,
      isBusy,
      isGroupSelected,
      preview,
      previewLoading,
      selectAllFields,
      selectPostFields,
      selectedFields,
      selectedFieldSet,
      toggleGroup,
      visible
    }
  }
}
</script>

<style scoped>
.source-link-rewrite-body {
  min-height: 420px;
}

.source-link-rewrite-summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.source-link-rewrite-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.source-link-rewrite-subtitle {
  margin-top: 6px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.source-link-rewrite-site-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  max-width: 520px;
}

.source-link-rewrite-site-list :deep(.el-tag__content) {
  max-width: 480px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.source-link-rewrite-panel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.source-link-rewrite-preview-panel {
  display: block;
  min-height: 0;
  padding: 14px;
  max-height: 62vh;
  overflow: auto;
  font-size: var(--el-font-size-base);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.source-link-rewrite-preview-group + .source-link-rewrite-preview-group {
  margin-top: 18px;
}

.source-link-rewrite-preview-group-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.source-link-rewrite-preview-list {
  display: grid;
  gap: 10px;
}

.source-link-rewrite-preview-item {
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}

.source-link-rewrite-preview-item.is-selected {
  border-color: var(--el-color-success-light-5);
  background: var(--el-color-success-light-9);
}

.source-link-rewrite-preview-field-head {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.source-link-rewrite-card-checkbox {
  width: 100%;
  margin-right: 0;
  white-space: normal;
}

.source-link-rewrite-card-checkbox :deep(.el-checkbox__label) {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
  line-height: 1.4;
}

.source-link-rewrite-entry-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.source-link-rewrite-record-label {
  color: var(--el-text-color-primary);
  overflow-wrap: anywhere;
}

.source-link-rewrite-relation-labels {
  color: var(--el-text-color-secondary);
}

.source-link-rewrite-match-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.source-link-rewrite-compare-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.source-link-rewrite-compare-cell {
  min-width: 0;
  padding: 10px;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
}

.source-link-rewrite-compare-label {
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.source-link-rewrite-compare-text {
  max-height: 220px;
  min-height: 44px;
  overflow: auto;
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.55;
  font-family: var(--el-font-family);
  color: var(--el-text-color-primary);
}

.source-link-rewrite-highlight {
  padding: 1px 3px;
  border-radius: 4px;
  color: var(--el-text-color-primary);
}

.source-link-rewrite-highlight.is-current {
  background: var(--el-color-warning-light-7);
}

.source-link-rewrite-highlight.is-next {
  background: var(--el-color-success-light-7);
}

@media (max-width: 900px) {
  .source-link-rewrite-summary {
    display: block;
  }

  .source-link-rewrite-site-list {
    justify-content: flex-start;
    max-width: none;
    margin-top: 10px;
  }

  .source-link-rewrite-site-list :deep(.el-tag__content) {
    max-width: calc(96vw - 80px);
  }

  .source-link-rewrite-preview-panel {
    max-height: none;
  }

  .source-link-rewrite-compare-grid {
    grid-template-columns: 1fr;
  }
}
</style>
