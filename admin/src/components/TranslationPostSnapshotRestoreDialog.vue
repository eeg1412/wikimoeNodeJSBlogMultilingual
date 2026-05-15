<template>
  <el-dialog
    v-model="visible"
    title="同步快照"
    width="min(1080px, 96vw)"
    class="translation-snapshot-restore-dialog"
    align-center
    :close-on-click-modal="!isBusy"
    :close-on-press-escape="!isBusy"
  >
    <div v-loading="previewLoading" class="snapshot-restore-body">
      <div class="snapshot-restore-summary">
        <div>
          <div class="snapshot-restore-title">选择需要同步的快照字段</div>
          <div class="snapshot-restore-subtitle">
            已选择 {{ selectedFields.length }} /
            {{ allFieldKeys.length }} 个字段
          </div>
        </div>
        <div class="snapshot-restore-version-list">
          <el-tag type="info" effect="plain">
            当前版本：{{ preview.currentSnapshotVersion || '-' }}
          </el-tag>
          <el-tag type="success" effect="plain">
            源快照版本：{{ preview.sourceSnapshotVersion || '-' }}
          </el-tag>
        </div>
      </div>

      <div class="snapshot-restore-panel-actions">
        <el-button size="small" plain @click="selectAllFields">全选</el-button>
        <el-button size="small" plain @click="selectChangedFields">
          只选引用有变化
        </el-button>
        <el-button size="small" plain @click="clearSelectedFields">
          清空
        </el-button>
      </div>

      <el-checkbox-group
        v-model="selectedFields"
        class="snapshot-restore-preview-panel"
      >
        <section>
          <div
            v-for="group in preview.groups"
            :key="group.key"
            class="snapshot-restore-preview-group"
          >
            <div class="snapshot-restore-preview-group-title">
              <span>{{ group.label }}</span>
              <el-button size="small" text @click="toggleGroup(group)">
                {{ isGroupSelected(group) ? '取消本组' : '选择本组' }}
              </el-button>
            </div>
            <div class="snapshot-restore-preview-list">
              <div
                v-for="field in group.fields"
                :key="field.key"
                class="snapshot-restore-preview-item"
                :class="{
                  'is-selected': selectedFieldSet.has(field.key),
                  'is-changed': field.changed
                }"
              >
                <div class="snapshot-restore-preview-field-head">
                  <el-checkbox
                    :value="field.key"
                    class="snapshot-restore-card-checkbox"
                  >
                    <span>{{ field.label }}</span>
                    <el-tag
                      v-if="field.changed"
                      size="small"
                      type="warning"
                      effect="plain"
                    >
                      引用有变化
                    </el-tag>
                  </el-checkbox>
                </div>
                <div class="snapshot-restore-compare-grid">
                  <div class="snapshot-restore-compare-cell">
                    <div class="snapshot-restore-compare-label">现在</div>
                    <div
                      v-if="field.key === 'content'"
                      class="snapshot-restore-compare-text snapshot-restore-rich-preview"
                      v-html="field.currentText"
                    />
                    <div v-else class="snapshot-restore-compare-text">
                      {{ field.currentText }}
                    </div>
                  </div>
                  <div class="snapshot-restore-compare-cell">
                    <div class="snapshot-restore-compare-label">
                      源快照（原来）
                    </div>
                    <div
                      v-if="field.key === 'content'"
                      class="snapshot-restore-compare-text snapshot-restore-rich-preview"
                      v-html="field.snapshotText"
                    />
                    <div v-else class="snapshot-restore-compare-text">
                      {{ field.snapshotText }}
                    </div>
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
        :loading="restoring"
        :disabled="previewLoading || selectedFields.length === 0"
        @click="restoreSelectedFields"
      >
        同步选中字段
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
    groups: [],
    defaultFields: [],
    currentSnapshotVersion: null,
    sourceSnapshotVersion: null,
    languageCode: '',
    sourceLanguageCode: ''
  }
}

export default {
  name: 'TranslationPostSnapshotRestoreDialog',
  props: {
    modelValue: { type: Boolean, default: false },
    postId: { type: String, default: '' },
    sourceSnapshotId: { type: String, default: '' },
    languageCode: { type: String, default: '' }
  },
  emits: ['update:modelValue', 'restored'],
  setup(props, { emit }) {
    const previewLoading = ref(false)
    const restoring = ref(false)
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
      return previewLoading.value || restoring.value
    })

    const allFieldKeys = computed(() => {
      return preview.groups.flatMap(group => {
        return group.fields.map(field => field.key)
      })
    })

    const selectedFieldSet = computed(() => {
      return new Set(selectedFields.value)
    })

    const changedFieldKeys = computed(() => {
      return preview.groups.flatMap(group => {
        return group.fields
          .filter(field => field.changed)
          .map(field => field.key)
      })
    })

    function resetPreview(data) {
      Object.assign(preview, createEmptyPreview(), data || {})
      if (
        Array.isArray(preview.defaultFields) &&
        preview.defaultFields.length > 0
      ) {
        selectedFields.value = [...preview.defaultFields]
        return
      }
      selectedFields.value = allFieldKeys.value
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
          await multilingualApi.getTranslationPostSnapshotRestorePreview(
            {
              id: props.postId,
              sourceSnapshotId: props.sourceSnapshotId,
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
      selectedFields.value = [...allFieldKeys.value]
    }

    function selectChangedFields() {
      selectedFields.value = [...changedFieldKeys.value]
    }

    function clearSelectedFields() {
      selectedFields.value = []
    }

    function isGroupSelected(group) {
      const groupKeys = group.fields.map(field => field.key)
      return groupKeys.every(key => selectedFieldSet.value.has(key))
    }

    function toggleGroup(group) {
      const groupKeys = group.fields.map(field => field.key)
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

    async function restoreSelectedFields() {
      if (selectedFields.value.length === 0) {
        ElMessage.warning('请选择至少一个同步字段')
        return
      }

      restoring.value = true
      try {
        const response = await multilingualApi.restoreTranslationPostSnapshot({
          id: props.postId,
          sourceSnapshotId: props.sourceSnapshotId,
          languageCode: props.languageCode,
          fields: selectedFields.value
        })
        ElMessage.success('已同步选中的快照字段')
        emit('restored', response.data.data)
        visible.value = false
      } finally {
        restoring.value = false
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
      allFieldKeys,
      clearSelectedFields,
      isBusy,
      isGroupSelected,
      preview,
      previewLoading,
      restoreSelectedFields,
      restoring,
      selectAllFields,
      selectChangedFields,
      selectedFields,
      selectedFieldSet,
      toggleGroup,
      visible
    }
  }
}
</script>

<style scoped>
.snapshot-restore-body {
  min-height: 420px;
}

.snapshot-restore-summary {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.snapshot-restore-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.snapshot-restore-subtitle {
  margin-top: 6px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.snapshot-restore-version-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.snapshot-restore-preview-panel {
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

.snapshot-restore-panel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.snapshot-restore-preview-group + .snapshot-restore-preview-group {
  margin-top: 18px;
}

.snapshot-restore-preview-group-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.snapshot-restore-preview-list {
  display: grid;
  gap: 10px;
}

.snapshot-restore-preview-item {
  padding: 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}

.snapshot-restore-preview-item.is-selected {
  border-color: var(--el-color-success-light-5);
  background: var(--el-color-success-light-9);
}

.snapshot-restore-preview-item.is-changed:not(.is-selected) {
  border-color: var(--el-color-warning-light-5);
}

.snapshot-restore-preview-field-head {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 10px;
  margin-bottom: 10px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.snapshot-restore-card-checkbox {
  width: 100%;
  margin-right: 0;
  white-space: normal;
}

.snapshot-restore-card-checkbox :deep(.el-checkbox__label) {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
  line-height: 1.4;
}

.snapshot-restore-compare-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.snapshot-restore-compare-cell {
  min-width: 0;
  padding: 10px;
  border-radius: 6px;
  background: var(--el-fill-color-lighter);
}

.snapshot-restore-compare-label {
  margin-bottom: 6px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.snapshot-restore-compare-text {
  max-height: 150px;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.5;
  color: var(--el-text-color-primary);
}

.snapshot-restore-rich-preview {
  max-height: 260px;
  white-space: normal;
}

.snapshot-restore-rich-preview :deep(img),
.snapshot-restore-rich-preview :deep(video),
.snapshot-restore-rich-preview :deep(iframe) {
  max-width: 100%;
}

.snapshot-restore-rich-preview :deep(p:first-child) {
  margin-top: 0;
}

.snapshot-restore-rich-preview :deep(p:last-child) {
  margin-bottom: 0;
}

@media (max-width: 900px) {
  .snapshot-restore-summary {
    display: block;
  }

  .snapshot-restore-version-list {
    justify-content: flex-start;
    margin-top: 10px;
  }

  .snapshot-restore-preview-panel {
    max-height: none;
  }

  .snapshot-restore-compare-grid {
    grid-template-columns: 1fr;
  }
}
</style>
